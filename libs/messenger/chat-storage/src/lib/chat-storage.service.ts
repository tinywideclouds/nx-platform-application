import { Injectable, inject } from '@angular/core';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  DecryptedMessage,
  ConversationSummary,
  MessageDeliveryStatus,
} from '@nx-platform-application/messenger-types';
import { Logger } from '@nx-platform-application/console-logger';
import { Dexie } from 'dexie';
import {
  ConversationIndexRecord,
  MessageRecord,
} from './db/chat-storage.models';
import { MessageTombstone, ConversationSyncState } from './chat.models';
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
  private readonly mergeStrategy = inject(ChatMergeStrategy);
  private readonly deletionStrategy = inject(ChatDeletionStrategy);
  private readonly mapper = inject(ChatStorageMapper);

  async saveMessage(message: DecryptedMessage): Promise<boolean> {
    const msgRecord = this.mapper.mapSmartToRecord(message);
    const conversationUrnStr = message.conversationUrn.toString();
    const now = new Date().toISOString();

    return this.db.transaction(
      'rw',
      [this.db.messages, this.db.conversations],
      async () => {
        const existingRecord = await this.db.messages.get(message.messageId);

        if (existingRecord) {
          if (existingRecord.status !== message.status) {
            this.logger.debug(
              `[ChatStorage] Updating status for ${message.messageId}: ${existingRecord.status} -> ${message.status}`,
            );
          } else {
            this.logger.warn(
              `[ChatStorage] Duplicate message ignored: ${message.messageId}`,
            );
            return false;
          }
        }

        await this.db.messages.put(msgRecord);

        const existingConv =
          await this.db.conversations.get(conversationUrnStr);
        const isNewer =
          !existingConv ||
          message.sentTimestamp >= existingConv.lastActivityTimestamp;
        const isOlder =
          existingConv?.genesisTimestamp &&
          message.sentTimestamp < existingConv.genesisTimestamp;

        const update: ConversationIndexRecord = existingConv || {
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
          if (message.status === 'received' && !existingRecord) {
            update.unreadCount = (existingConv?.unreadCount || 0) + 1;
          }
        }

        if (isOlder) {
          update.genesisTimestamp = message.sentTimestamp;
        }

        await this.db.conversations.put(update);
        return true;
      },
    );
  }

  async markConversationAsRead(urn: URN): Promise<void> {
    const strUrn = urn.toString();
    await this.db.conversations.update(strUrn, {
      unreadCount: 0,
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    return this.deletionStrategy.deleteMessage(this, messageId);
  }

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
    beforeTimestamp?: ISODateTimeString,
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

  async getConversationIndex(
    urn: URN,
  ): Promise<ConversationSyncState | undefined> {
    const record = await this.db.conversations.get(urn.toString());
    return record ? this.mapIndexRecordToSmart(record) : undefined;
  }

  async setGenesisTimestamp(
    urn: URN,
    timestamp: ISODateTimeString,
  ): Promise<void> {
    const strUrn = urn.toString();
    const existing = await this.db.conversations.get(strUrn);
    if (existing) {
      await this.db.conversations.update(strUrn, {
        genesisTimestamp: timestamp,
      });
    }
  }

  async getMessagesInRange(
    start: ISODateTimeString,
    end: ISODateTimeString,
  ): Promise<DecryptedMessage[]> {
    const records = await this.db.messages
      .where('sentTimestamp')
      .between(start, end, true, true)
      .toArray();
    return records.map((r) => this.mapper.mapRecordToSmart(r));
  }

  async getTombstonesInRange(
    start: ISODateTimeString,
    end: ISODateTimeString,
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

  async getAllConversations(): Promise<ConversationSyncState[]> {
    const records = await this.db.conversations.toArray();
    return records.map((r) => this.mapIndexRecordToSmart(r));
  }

  async smartMergeConversations(
    cloudIndex: ConversationSyncState[],
  ): Promise<void> {
    const records: ConversationIndexRecord[] = cloudIndex.map((s) => ({
      ...s,
      conversationUrn: s.conversationUrn.toString(),
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

  async updateMessageStatus(
    messageIds: string[],
    status: MessageDeliveryStatus,
  ): Promise<void> {
    if (messageIds.length === 0) return;
    await this.db.transaction('rw', this.db.messages, async () => {
      const records = await this.db.messages.bulkGet(messageIds);
      const updates: any[] = [];
      records.forEach((record) => {
        if (record && record.status !== status) {
          updates.push({ ...record, status });
        }
      });
      this.logger.debug(
        `[ChatStorage] updating status to ${status}`,
        messageIds,
      );
      if (updates.length > 0) {
        await this.db.messages.bulkPut(updates);
      }
    });
  }

  async setCloudEnabled(enabled: boolean): Promise<void> {
    await this.db.settings.put({ key: 'chat_cloud_enabled', value: enabled });
  }

  async isCloudEnabled(): Promise<boolean> {
    const r = await this.db.settings.get('chat_cloud_enabled');
    return r?.value === true;
  }

  async clearMessageHistory(): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.conversations, this.db.quarantined_messages],
      async () => {
        await Promise.all([
          this.db.messages.clear(),
          this.db.conversations.clear(),
          this.db.quarantined_messages.clear(),
        ]);
      },
    );
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
      },
    );
  }

  public mapRecordToSmart(record: MessageRecord): DecryptedMessage {
    return this.mapper.mapRecordToSmart(record);
  }

  public generateSnippet(msg: DecryptedMessage): string {
    return generateSnippet(msg);
  }

  public getPreviewType(
    typeIdStr: string,
  ): 'text' | 'image' | 'file' | 'other' {
    return getPreviewType(typeIdStr);
  }

  private mapIndexRecordToSmart(
    record: ConversationIndexRecord,
  ): ConversationSyncState {
    return {
      ...record,
      conversationUrn: URN.parse(record.conversationUrn),
      lastActivityTimestamp: record.lastActivityTimestamp as ISODateTimeString,
      lastModified: record.lastModified as ISODateTimeString,
      genesisTimestamp: (record.genesisTimestamp as ISODateTimeString) || null,
    };
  }

  async saveQuarantinedMessage(message: DecryptedMessage): Promise<void> {
    const msgRecord = this.mapper.mapSmartToRecord(message);
    await this.db.quarantined_messages.put(msgRecord);
  }

  async getQuarantinedMessages(urn: URN): Promise<DecryptedMessage[]> {
    const records = await this.db.quarantined_messages
      .where('conversationUrn')
      .equals(urn.toString())
      .toArray();

    return records.map((r) => this.mapper.mapRecordToSmart(r));
  }

  async deleteQuarantinedMessages(urn: URN): Promise<void> {
    const urnStr = urn.toString();
    const records = await this.db.quarantined_messages
      .where('conversationUrn')
      .equals(urnStr)
      .toArray();
    const ids = records.map((r) => r.messageId);
    await this.db.quarantined_messages.bulkDelete(ids);
  }

  async promoteQuarantinedMessages(oldUrn: URN, newUrn: URN): Promise<void> {
    const oldUrnStr = oldUrn.toString();
    const newUrnStr = newUrn.toString();

    await this.db.transaction(
      'rw',
      [this.db.quarantined_messages, this.db.messages, this.db.conversations],
      async () => {
        const quarantined = await this.db.quarantined_messages
          .where('conversationUrn')
          .equals(oldUrnStr)
          .toArray();

        if (quarantined.length === 0) return;

        const toSave = quarantined.map((record) => ({
          ...record,
          conversationUrn: newUrnStr,
        }));

        await this.db.messages.bulkPut(toSave);

        toSave.sort((a, b) => (b.sentTimestamp > a.sentTimestamp ? 1 : -1));
        const latest = toSave[0];
        const latestSmart = this.mapper.mapRecordToSmart(latest);

        const existing = await this.db.conversations.get(newUrnStr);
        const now = new Date().toISOString();

        const update: any = existing || {
          conversationUrn: newUrnStr,
          lastActivityTimestamp: latest.sentTimestamp,
          snippet: '',
          previewType: 'text',
          unreadCount: 0,
          genesisTimestamp: null,
          lastModified: now,
        };

        update.lastActivityTimestamp = latest.sentTimestamp;
        update.snippet = generateSnippet(latestSmart);
        update.previewType = getPreviewType(latest.typeId);
        update.unreadCount = (existing?.unreadCount || 0) + toSave.length;
        update.lastModified = now;

        await this.db.conversations.put(update);

        const idsToDelete = quarantined.map((m) => m.messageId);
        await this.db.quarantined_messages.bulkDelete(idsToDelete);
      },
    );
  }
}
