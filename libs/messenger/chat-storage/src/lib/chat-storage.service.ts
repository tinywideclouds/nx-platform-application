import { Injectable, inject } from '@angular/core';
import { Dexie } from 'dexie';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  TransportMessage,
  MessageDeliveryStatus,
  ConversationSummary,
  ConversationSyncState,
  MessageTombstone,
} from '@nx-platform-application/messenger-types';
import { MessengerDatabase } from './db/messenger.database';
import { ChatStorageMapper } from './chat-storage.mapper';
import { ChatDeletionStrategy } from './strategies/chat-deletion.strategy';
import {
  MessageRecord,
  ConversationIndexRecord,
} from './db/chat-storage.models';
import { generateSnippet, getPreviewType } from './chat-message.utils';

export interface ChatStorageQueryOptions {
  conversationUrn: URN;
  limit?: number;
  beforeTimestamp?: ISODateTimeString;
}

@Injectable({ providedIn: 'root' })
export class ChatStorageService {
  private db = inject(MessengerDatabase);
  private mapper = inject(ChatStorageMapper);
  private deletionStrategy = inject(ChatDeletionStrategy);

  // --- REPOSITORY INTERFACE IMPLEMENTATION ---

  async loadHistorySegment(
    conversationUrn: URN,
    limit: number,
    beforeTimestamp?: string,
  ): Promise<ChatMessage[]> {
    const convoId = conversationUrn.toString();
    const upperBound = beforeTimestamp || Dexie.maxKey;

    let collection = this.db.messages
      .where('[conversationUrn+sentTimestamp]')
      .between([convoId, Dexie.minKey], [convoId, upperBound], false, false)
      .reverse();

    if (limit > 0) {
      collection = collection.limit(limit);
    }

    const records = await collection.toArray();
    return records.map((r) => this.mapper.mapRecordToDomain(r));
  }

  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    const records = await this.db.conversations
      .orderBy('lastActivityTimestamp')
      .reverse()
      .toArray();

    return records.map(
      (r) =>
        ({
          conversationUrn: URN.parse(r.conversationUrn),
          lastActivity: r.lastActivityTimestamp as ISODateTimeString,
          snippet: r.snippet,
          previewType: r.previewType,
          unreadCount: r.unreadCount,
          lastMessage: undefined,
        }) as any,
    );
  }

  async setGenesisTimestamp(
    urn: URN,
    timestamp: ISODateTimeString,
  ): Promise<void> {
    await this.updateConversation(urn, { genesisTimestamp: timestamp });
  }

  // --- CLOUD SYNC SUPPORT (Restored Methods) ---

  /**
   * Used by ChatCloudService to find deletions that need to be pushed to the cloud.
   */
  async getTombstonesInRange(
    start: string,
    end: string,
  ): Promise<MessageTombstone[]> {
    const records = await this.db.tombstones
      .where('deletedAt')
      .between(start, end)
      .toArray();

    return records.map((r) => ({
      messageId: r.messageId,
      conversationUrn: URN.parse(r.conversationUrn),
      deletedAt: r.deletedAt as ISODateTimeString,
    }));
  }

  /**
   * Used by ChatCloudService to determine the local time range of data.
   */
  async getDataRange(): Promise<{ min: string; max: string } | null> {
    const first = await this.db.messages.orderBy('sentTimestamp').first();
    const last = await this.db.messages.orderBy('sentTimestamp').last();

    if (!first || !last) return null;
    return {
      min: first.sentTimestamp,
      max: last.sentTimestamp,
    };
  }

  /** Used by ChatCloudService to get all raw Messages for a time range (Backup) */
  async getMessagesInRange(start: string, end: string): Promise<ChatMessage[]> {
    const records = await this.db.messages
      .where('sentTimestamp')
      .between(start, end)
      .toArray();
    return records.map((r) => this.mapper.mapRecordToDomain(r));
  }

  async setCloudEnabled(enabled: boolean): Promise<void> {
    await this.db.settings.put({ key: 'cloud_enabled', value: enabled });
  }

  async isCloudEnabled(): Promise<boolean> {
    const setting = await this.db.settings.get('cloud_enabled');
    return setting?.value ?? false;
  }

  async bulkSaveMessages(messages: ChatMessage[]): Promise<void> {
    // Re-use single save logic or optimize with bulkPut if mapper allows
    // For safety, we loop to ensure side-effects (conversation updates) run.
    // Optimization: In V2 we can make this a true bulk transaction.
    for (const msg of messages) {
      await this.saveMessage(msg);
    }
  }

  async bulkSaveConversations(
    conversations: ConversationSyncState[],
  ): Promise<void> {
    const records: ConversationIndexRecord[] = conversations.map((c) => ({
      conversationUrn: c.conversationUrn.toString(),
      lastActivityTimestamp: c.lastActivityTimestamp,
      snippet: c.snippet,
      previewType: c.previewType,
      unreadCount: c.unreadCount,
      genesisTimestamp: c.genesisTimestamp,
      lastModified: c.lastModified,
    }));
    await this.db.conversations.bulkPut(records);
  }

  async getAllConversations(): Promise<ConversationSyncState[]> {
    const records = await this.db.conversations.toArray();
    return records.map((r) => ({
      conversationUrn: URN.parse(r.conversationUrn),
      lastActivityTimestamp: r.lastActivityTimestamp as ISODateTimeString,
      snippet: r.snippet,
      previewType: r.previewType,
      unreadCount: r.unreadCount,
      genesisTimestamp: r.genesisTimestamp as ISODateTimeString | null,
      lastModified: r.lastModified as ISODateTimeString,
    }));
  }

  // --- WRITER / RESCUE ---

  async saveMessage(message: ChatMessage): Promise<void> {
    const record = this.mapper.mapDomainToRecord(message);
    const conversationUrnStr = message.conversationUrn.toString();
    const sentTime = message.sentTimestamp;

    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.conversations],
      async () => {
        await this.db.messages.put(record);

        const existing = await this.db.conversations.get(conversationUrnStr);
        const now = new Date().toISOString();

        const isNewer = !existing || sentTime >= existing.lastActivityTimestamp;
        const isOlder =
          existing?.genesisTimestamp && sentTime < existing.genesisTimestamp;

        const update: ConversationIndexRecord = existing || {
          conversationUrn: conversationUrnStr,
          lastActivityTimestamp: sentTime,
          snippet: '',
          previewType: 'text',
          unreadCount: 0,
          lastModified: now,
          genesisTimestamp: null,
        };

        update.lastModified = now;

        if (isNewer) {
          update.lastActivityTimestamp = sentTime;
          update.snippet = generateSnippet(message);
          update.previewType = getPreviewType(message.typeId.toString());
          if (message.status === 'received') {
            update.unreadCount = (existing?.unreadCount || 0) + 1;
          }
        }

        if (isOlder) {
          update.genesisTimestamp = sentTime;
        }

        await this.db.conversations.put(update);
      },
    );
  }

  async getConversationIndex(
    conversationUrn: URN,
  ): Promise<ConversationSyncState | undefined> {
    const record = await this.db.conversations.get(conversationUrn.toString());
    if (!record) return undefined;

    return {
      conversationUrn: URN.parse(record.conversationUrn),
      lastActivityTimestamp: record.lastActivityTimestamp as ISODateTimeString,
      genesisTimestamp: record.genesisTimestamp
        ? (record.genesisTimestamp as ISODateTimeString)
        : null,
      snippet: record.snippet,
      unreadCount: record.unreadCount,
      lastModified: record.lastModified as ISODateTimeString,
      previewType: record.previewType,
    };
  }

  async updateConversation(
    urn: URN,
    changes: Partial<ConversationIndexRecord>,
  ): Promise<number> {
    return this.db.conversations.update(urn.toString(), changes);
  }

  async markConversationAsRead(conversationUrn: URN): Promise<void> {
    await this.updateConversation(conversationUrn, { unreadCount: 0 });
  }

  async updateMessageStatus(
    messageIds: string[],
    status: MessageDeliveryStatus,
  ): Promise<void> {
    if (messageIds.length === 0) return;
    await this.db.messages.bulkUpdate(
      messageIds.map((id) => ({ key: id, changes: { status } })),
    );
  }

  async deleteMessage(id: string): Promise<void> {
    return this.deletionStrategy.deleteMessage(this, id);
  }

  public mapRecordToSmart(record: MessageRecord): ChatMessage {
    return this.mapper.mapRecordToDomain(record);
  }

  public generateSnippet(msg: ChatMessage): string {
    return generateSnippet(msg);
  }

  public getPreviewType(
    typeIdStr: string,
  ): 'text' | 'image' | 'file' | 'other' {
    return getPreviewType(typeIdStr);
  }

  async clearMessageHistory(): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.conversations, this.db.tombstones],
      async () => {
        await this.db.messages.clear();
        await this.db.conversations.clear();
        await this.db.tombstones.clear();
      },
    );
  }

  async clearDatabase(): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.messages,
        this.db.conversations,
        this.db.tombstones,
        this.db.quarantined_messages,
        this.db.settings,
      ],
      async () => {
        await this.db.messages.clear();
        await this.db.conversations.clear();
        await this.db.tombstones.clear();
        await this.db.quarantined_messages.clear();
        await this.db.settings.clear();
      },
    );
  }

  async saveQuarantinedMessage(message: TransportMessage): Promise<void> {
    await this.db.quarantined_messages.put({
      messageId: message.clientRecordId || crypto.randomUUID(),
      senderId: message.senderId.toString(),
      sentTimestamp: message.sentTimestamp,
      typeId: message.typeId.toString(),
      payloadBytes: message.payloadBytes,
      clientRecordId: message.clientRecordId,
    });
  }

  async getQuarantinedMessages(senderId: URN): Promise<ChatMessage[]> {
    const records = await this.db.quarantined_messages
      .where('senderId')
      .equals(senderId.toString())
      .sortBy('sentTimestamp');

    return records.map((r) => ({
      id: r.messageId,
      conversationUrn: URN.parse(r.senderId),
      senderId: URN.parse(r.senderId),
      sentTimestamp: r.sentTimestamp as ISODateTimeString,
      typeId: URN.parse(r.typeId),
      payloadBytes: r.payloadBytes,
      status: 'received',
    }));
  }

  async getQuarantinedSenders(): Promise<URN[]> {
    const uniqueSenders = await this.db.quarantined_messages
      .orderBy('senderId')
      .uniqueKeys();

    return uniqueSenders.map((k) => URN.parse(k as string));
  }

  async deleteQuarantinedMessages(senderId: URN): Promise<void> {
    await this.db.quarantined_messages
      .where('senderId')
      .equals(senderId.toString())
      .delete();
  }
}
