import { Injectable, inject } from '@angular/core';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/console-logger';
import { Dexie } from 'dexie';
import {
  ConversationIndexRecord,
  MessageRecord,
} from './db/chat-storage.models';
import {
  DecryptedMessage,
  ConversationSummary,
  MessageTombstone,
  ConversationSyncState,
} from './chat.models';
import { MessengerDatabase } from './db/messenger.database';
import { ChatMergeStrategy } from './strategies/chat-merge.strategy';
import { ChatDeletionStrategy } from './strategies/chat-deletion.strategy';
import { ChatStorageMapper } from './db/chat-storage.mapper';
import { generateSnippet, getPreviewType } from './chat-message.utils';

@Injectable({
  providedIn: 'root',
})
export class ChatStorageService {
  private readonly db = inject(MessengerDatabase);
  private readonly logger = inject(Logger);

  // Strategies and Mapper
  private readonly mergeStrategy = inject(ChatMergeStrategy);
  private readonly deletionStrategy = inject(ChatDeletionStrategy);
  private readonly mapper = inject(ChatStorageMapper);

  // --- WRITE PATHS ---

  async saveMessage(message: DecryptedMessage): Promise<void> {
    const msgRecord = this.mapper.mapSmartToRecord(message);
    const conversationUrnStr = message.conversationUrn.toString();
    const now = new Date().toISOString();

    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.conversations],
      async () => {
        await this.db.messages.put(msgRecord);

        const existing = await this.db.conversations.get(conversationUrnStr);
        const isNewer =
          !existing || message.sentTimestamp >= existing.lastActivityTimestamp;
        const isOlder =
          existing?.genesisTimestamp &&
          message.sentTimestamp < existing.genesisTimestamp;

        const update: ConversationIndexRecord = existing || {
          conversationUrn: conversationUrnStr,
          lastActivityTimestamp: message.sentTimestamp,
          snippet: '',
          previewType: 'text',
          unreadCount: 0,
          genesisTimestamp: null,
          lastModified: now,
        };

        update.lastModified = now;

        if (isNewer) {
          update.lastActivityTimestamp = message.sentTimestamp;
          update.snippet = generateSnippet(message);
          update.previewType = getPreviewType(message.typeId.toString());
          if (message.status === 'received') {
            update.unreadCount = (existing?.unreadCount || 0) + 1;
          }
        }

        if (isOlder) {
          update.genesisTimestamp = message.sentTimestamp;
        }

        await this.db.conversations.put(update);
      }
    );
  }

  /**
   * Resets the unread count for a conversation to 0.
   * * PREP WORK: This is where we will hook in the "Send Read Receipt" logic later.
   */
  async markConversationAsRead(urn: URN): Promise<void> {
    const strUrn = urn.toString();

    // We use update() instead of put() to ensure we don't accidentally create
    // a record if one doesn't exist (though it should).
    // This is also atomic within Dexie.
    await this.db.conversations.update(strUrn, {
      unreadCount: 0,
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    return this.deletionStrategy.deleteMessage(this, messageId);
  }

  // --- READ PATHS (UI) ---

  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    const records = await this.db.conversations
      .orderBy('lastActivityTimestamp')
      .reverse()
      .toArray();

    return records.map((r) => ({
      conversationUrn: URN.parse(r.conversationUrn),
      latestSnippet: r.snippet,
      timestamp: r.lastActivityTimestamp as ISODateTimeString,
      unreadCount: r.unreadCount,
      previewType: r.previewType,
    }));
  }

  async loadHistorySegment(
    conversationUrn: URN,
    limit: number,
    beforeTimestamp?: ISODateTimeString
  ): Promise<DecryptedMessage[]> {
    const urnStr = conversationUrn.toString();
    const upperBound = beforeTimestamp || Dexie.maxKey;

    const records = await this.db.messages
      .where('[conversationUrn+sentTimestamp]')
      .between([urnStr, Dexie.minKey], [urnStr, upperBound], true, false)
      .reverse()
      .limit(limit)
      .toArray();

    return records.map((r) => this.mapper.mapRecordToSmart(r));
  }

  // Returns Domain Object (SyncState) instead of DB Record
  async getConversationIndex(
    urn: URN
  ): Promise<ConversationSyncState | undefined> {
    const record = await this.db.conversations.get(urn.toString());
    return record ? this.mapIndexRecordToSmart(record) : undefined;
  }

  async setGenesisTimestamp(
    urn: URN,
    timestamp: ISODateTimeString
  ): Promise<void> {
    const strUrn = urn.toString();
    const existing = await this.db.conversations.get(strUrn);
    if (existing) {
      await this.db.conversations.update(strUrn, {
        genesisTimestamp: timestamp,
      });
    }
  }

  // --- SYNC HELPERS (Cloud Support) ---

  async getMessagesInRange(
    start: ISODateTimeString,
    end: ISODateTimeString
  ): Promise<DecryptedMessage[]> {
    const records = await this.db.messages
      .where('sentTimestamp')
      .between(start, end, true, true)
      .toArray();
    return records.map((r) => this.mapper.mapRecordToSmart(r));
  }

  // Returns Domain Objects (MessageTombstone)
  async getTombstonesInRange(
    start: ISODateTimeString,
    end: ISODateTimeString
  ): Promise<MessageTombstone[]> {
    const records = await this.db.tombstones
      .where('deletedAt')
      .between(start, end, true, true)
      .toArray();

    return records.map((r) => ({
      messageId: r.messageId,
      conversationUrn: URN.parse(r.conversationUrn),
      deletedAt: r.deletedAt as ISODateTimeString,
    }));
  }

  async getDataRange(): Promise<{
    min: ISODateTimeString | null;
    max: ISODateTimeString | null;
  }> {
    const first = await this.db.messages.orderBy('sentTimestamp').first();
    const last = await this.db.messages.orderBy('sentTimestamp').last();
    return {
      min: (first?.sentTimestamp as ISODateTimeString) || null,
      max: (last?.sentTimestamp as ISODateTimeString) || null,
    };
  }

  //  Returns Domain Objects
  async getAllConversations(): Promise<ConversationSyncState[]> {
    const records = await this.db.conversations.toArray();
    return records.map((r) => this.mapIndexRecordToSmart(r));
  }

  // --- CLOUD MERGE OPERATIONS ---

  // Accepts Domain Objects, maps to DB, then calls Strategy
  async smartMergeConversations(
    cloudIndex: ConversationSyncState[]
  ): Promise<void> {
    const records: ConversationIndexRecord[] = cloudIndex.map((s) => ({
      ...s,
      conversationUrn: s.conversationUrn.toString(),
      // Ensure ISO string types align with DB expectation
      lastActivityTimestamp: s.lastActivityTimestamp,
      lastModified: s.lastModified,
      genesisTimestamp: s.genesisTimestamp,
    }));

    return this.mergeStrategy.merge(records);
  }

  async bulkSaveConversations(records: ConversationSyncState[]): Promise<void> {
    return this.smartMergeConversations(records);
  }

  async bulkSaveMessages(messages: DecryptedMessage[]): Promise<void> {
    const records = messages.map((m) => this.mapper.mapSmartToRecord(m));
    await this.db.messages.bulkPut(records);
  }

  // --- SETTINGS & CLEANUP ---

  async setCloudEnabled(enabled: boolean): Promise<void> {
    await this.db.settings.put({ key: 'chat_cloud_enabled', value: enabled });
  }

  async isCloudEnabled(): Promise<boolean> {
    const r = await this.db.settings.get('chat_cloud_enabled');
    return r?.value === true;
  }

  async clearDatabase(): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.messages,
        this.db.settings,
        this.db.conversations,
        this.db.tombstones,
      ],
      async () => {
        await this.db.messages.clear();
        await this.db.settings.clear();
        await this.db.conversations.clear();
        await this.db.tombstones.clear();
      }
    );
  }

  // --- HELPERS (Internal & Public Delegation) ---

  public mapRecordToSmart(record: MessageRecord): DecryptedMessage {
    return this.mapper.mapRecordToSmart(record);
  }

  public generateSnippet(msg: DecryptedMessage): string {
    return generateSnippet(msg);
  }

  public getPreviewType(
    typeIdStr: string
  ): 'text' | 'image' | 'file' | 'other' {
    return getPreviewType(typeIdStr);
  }

  // Private Mapper for the Index
  private mapIndexRecordToSmart(
    record: ConversationIndexRecord
  ): ConversationSyncState {
    return {
      ...record,
      conversationUrn: URN.parse(record.conversationUrn),
      lastActivityTimestamp: record.lastActivityTimestamp as ISODateTimeString,
      lastModified: record.lastModified as ISODateTimeString,
      genesisTimestamp: (record.genesisTimestamp as ISODateTimeString) || null,
    };
  }
}
