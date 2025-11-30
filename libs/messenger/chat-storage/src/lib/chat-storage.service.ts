// libs/messenger/chat-storage/src/lib/chat-storage.service.ts

import { Injectable, inject } from '@angular/core';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/console-logger';
import { Dexie } from 'dexie';
import {
  DecryptedMessage,
  ConversationSummary,
  MessageRecord,
  ConversationIndexRecord,
} from './chat-storage.models';
import { MessengerDatabase } from './db/messenger.database';
import { ChatMergeStrategy } from './chat-merge.strategy';

@Injectable({
  providedIn: 'root',
})
export class ChatStorageService {
  private readonly db = inject(MessengerDatabase);
  private readonly logger = inject(Logger);
  private readonly mergeStrategy = inject(ChatMergeStrategy);

  // --- WRITE PATH (Dual-Write Transaction) ---

  async saveMessage(message: DecryptedMessage): Promise<void> {
    const msgRecord: MessageRecord = {
      ...message,
      senderId: message.senderId.toString(),
      recipientId: message.recipientId.toString(),
      typeId: message.typeId.toString(),
      conversationUrn: message.conversationUrn.toString(),
    };

    const conversationUrnStr = message.conversationUrn.toString();
    const now = new Date().toISOString();

    // TRANSACTION: Ensure Message and Index are always in sync
    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.conversations],
      async () => {
        // 1. Save the Message
        await this.db.messages.put(msgRecord);

        // 2. Update the Index (Upsert)
        const existing = await this.db.conversations.get(conversationUrnStr);

        // Logic: Is this message newer than what we have?
        const isNewer =
          !existing || message.sentTimestamp >= existing.lastActivityTimestamp;
        const isOlder =
          existing?.genesisTimestamp &&
          message.sentTimestamp < existing.genesisTimestamp;

        // Prepare update
        const update: ConversationIndexRecord = existing || {
          conversationUrn: conversationUrnStr,
          lastActivityTimestamp: message.sentTimestamp,
          snippet: '',
          previewType: 'text',
          unreadCount: 0,
          genesisTimestamp: null, // Unknown initially
          lastModified: now,
        };

        update.lastModified = now;

        // If this is the newest message, update the Sidebar preview
        if (isNewer) {
          update.lastActivityTimestamp = message.sentTimestamp;
          update.snippet = this.generateSnippet(message);
          update.previewType = this.getPreviewType(message.typeId.toString());

          // Increment unread only for incoming messages
          if (message.status === 'received') {
            update.unreadCount = (existing?.unreadCount || 0) + 1;
          }
        }

        // If this message is OLDER than our known genesis, push boundaries back
        if (isOlder) {
          update.genesisTimestamp = message.sentTimestamp;
        }

        await this.db.conversations.put(update);
      }
    );
  }

  // --- READ PATH (Optimized) ---

  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    const records = await this.db.conversations
      .orderBy('lastActivityTimestamp')
      .reverse() // Newest chats first
      .toArray();

    return records.map((r) => ({
      conversationUrn: URN.parse(r.conversationUrn),
      latestSnippet: r.snippet,
      timestamp: r.lastActivityTimestamp as ISODateTimeString,
      unreadCount: r.unreadCount,
      previewType: r.previewType,
    }));
  }

  async getConversationIndex(
    urn: URN
  ): Promise<ConversationIndexRecord | undefined> {
    return this.db.conversations.get(urn.toString());
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

  // --- SYNC & RESTORE HELPERS ---

  async getAllConversations(): Promise<ConversationIndexRecord[]> {
    return this.db.conversations.toArray();
  }

  /**
   * Intelligently merges a Cloud Index into the Local Index.
   * Delegates to ChatMergeStrategy to resolve conflicts.
   */
  async smartMergeConversations(
    cloudIndex: ConversationIndexRecord[]
  ): Promise<void> {
    return this.mergeStrategy.merge(cloudIndex);
  }

  /**
   * Alias for smartMerge.
   * Used during "Fresh Install" to populate the UI instantly.
   */
  async bulkSaveConversations(
    records: ConversationIndexRecord[]
  ): Promise<void> {
    return this.smartMergeConversations(records);
  }

  async bulkSaveMessages(messages: DecryptedMessage[]): Promise<void> {
    // NOTE: We do NOT calculate summaries here to keep restore fast.
    // We assume the Global Index Restore handles the UI state.
    const records = messages.map((msg) => ({
      ...msg,
      senderId: msg.senderId.toString(),
      recipientId: msg.recipientId.toString(),
      typeId: msg.typeId.toString(),
      conversationUrn: msg.conversationUrn.toString(),
    }));
    await this.db.messages.bulkPut(records);
  }

  // --- EXISTING METHODS (Maintained) ---

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

    return records.reverse().map(this.mapRecordToSmart);
  }

  async clearDatabase(): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.settings, this.db.conversations],
      async () => {
        await this.db.messages.clear();
        await this.db.settings.clear();
        await this.db.conversations.clear();
      }
    );
  }

  async getMessagesInRange(
    start: ISODateTimeString,
    end: ISODateTimeString
  ): Promise<DecryptedMessage[]> {
    const records = await this.db.messages
      .where('sentTimestamp')
      .between(start, end, true, true)
      .toArray();
    return records.map(this.mapRecordToSmart);
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

  async setCloudEnabled(enabled: boolean): Promise<void> {
    await this.db.settings.put({ key: 'chat_cloud_enabled', value: enabled });
  }

  async isCloudEnabled(): Promise<boolean> {
    const r = await this.db.settings.get('chat_cloud_enabled');
    return r?.value === true;
  }

  // --- PRIVATE MAPPER HELPERS ---

  private mapRecordToSmart(record: MessageRecord): DecryptedMessage {
    return {
      ...record,
      senderId: URN.parse(record.senderId),
      recipientId: URN.parse(record.recipientId),
      typeId: URN.parse(record.typeId),
      conversationUrn: URN.parse(record.conversationUrn),
    };
  }

  private generateSnippet(msg: DecryptedMessage): string {
    // FIX: Using correct namespace 'urn:message:type:text'
    if (msg.typeId.toString() === 'urn:message:type:text') {
      try {
        return new TextDecoder().decode(msg.payloadBytes);
      } catch {
        return 'Message';
      }
    }
    return 'Media Message';
  }

  private getPreviewType(
    typeIdStr: string
  ): 'text' | 'image' | 'file' | 'other' {
    // FIX: Using correct namespace
    if (typeIdStr === 'urn:message:type:text') return 'text';
    if (typeIdStr.includes('image')) return 'image';
    return 'other';
  }
}
