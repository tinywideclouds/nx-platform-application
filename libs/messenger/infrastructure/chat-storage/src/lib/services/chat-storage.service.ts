import { Injectable, inject } from '@angular/core';
import { Dexie } from 'dexie';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  MessageDeliveryStatus,
  ConversationSummary,
  ConversationSyncState,
  MessageTombstone,
} from '@nx-platform-application/messenger-types';

import {
  MessengerDatabase,
  MessageMapper,
  ConversationMapper,
  ConversationIndexRecord,
  generateSnippet,
  getPreviewType,
} from '@nx-platform-application/messenger-infrastructure-db-schema';

import { ChatDeletionStrategy } from '../strategies/chat-deletion.strategy';

// ✅ Port Imports
import {
  HistoryReader,
  HistoryQuery,
  HistoryResult,
  ConversationStorage,
} from '@nx-platform-application/messenger-domain-conversation';

export interface ChatStorageQueryOptions {
  conversationUrn: URN;
  limit?: number;
  beforeTimestamp?: ISODateTimeString;
}

@Injectable({ providedIn: 'root' })
export class ChatStorageService implements HistoryReader, ConversationStorage {
  private db = inject(MessengerDatabase);
  private deletionStrategy = inject(ChatDeletionStrategy);

  private messageMapper = inject(MessageMapper);
  private conversationMapper = inject(ConversationMapper);

  // --- HistoryReader Implementation ---

  async getMessages(query: HistoryQuery): Promise<HistoryResult> {
    const messages = await this.loadHistorySegment(
      query.conversationUrn,
      query.limit,
      query.beforeTimestamp,
    );

    return {
      messages,
      genesisReached: messages.length < query.limit,
    };
  }

  async getConversationSummaries(): Promise<ConversationSummary[]> {
    return this.loadConversationSummaries();
  }

  // --- History Reads ---

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
    return records.map((r) => this.messageMapper.toDomain(r));
  }

  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    const records = await this.db.conversations
      .orderBy('lastActivityTimestamp')
      .reverse()
      .toArray();

    return records.map((r) => this.conversationMapper.toDomain(r));
  }

  async setGenesisTimestamp(
    urn: URN,
    timestamp: ISODateTimeString,
  ): Promise<void> {
    await this.updateConversation(urn, { genesisTimestamp: timestamp });
  }

  // --- Cloud Sync Support ---

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
      deletedAt: r.deletedAt,
    }));
  }

  async getDataRange(): Promise<{ min: string; max: string } | null> {
    const first = await this.db.messages.orderBy('sentTimestamp').first();
    const last = await this.db.messages.orderBy('sentTimestamp').last();

    if (!first || !last) return null;
    return {
      min: first.sentTimestamp,
      max: last.sentTimestamp,
    };
  }

  async getMessagesInRange(start: string, end: string): Promise<ChatMessage[]> {
    const records = await this.db.messages
      .where('sentTimestamp')
      .between(start, end)
      .toArray();
    return records.map((r) => this.messageMapper.toDomain(r));
  }

  async setCloudEnabled(enabled: boolean): Promise<void> {
    await this.db.settings.put({ key: 'cloud_enabled', value: enabled });
  }

  async isCloudEnabled(): Promise<boolean> {
    const setting = await this.db.settings.get('cloud_enabled');
    return setting?.value ?? false;
  }

  async bulkSaveMessages(messages: ChatMessage[]): Promise<void> {
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
      lastActivityTimestamp: r.lastActivityTimestamp,
      snippet: r.snippet,
      previewType: r.previewType,
      unreadCount: r.unreadCount,
      genesisTimestamp: r.genesisTimestamp,
      lastModified: r.lastModified,
    }));
  }

  // --- Writer / Rescue ---

  async saveMessage(message: ChatMessage): Promise<void> {
    const record = this.messageMapper.toRecord(message);
    const conversationUrnStr = message.conversationUrn.toString();
    const sentTime = message.sentTimestamp;

    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.conversations],
      async () => {
        await this.db.messages.put(record);

        const existing = await this.db.conversations.get(conversationUrnStr);
        const now = Temporal.Now.instant().toString() as ISODateTimeString;

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
      lastActivityTimestamp: record.lastActivityTimestamp,
      genesisTimestamp: record.genesisTimestamp,
      snippet: record.snippet,
      unreadCount: record.unreadCount,
      lastModified: record.lastModified,
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
    return this.deletionStrategy.deleteMessage(id);
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
        this.db.outbox,
      ],
      async () => {
        await this.db.messages.clear();
        await this.db.conversations.clear();
        await this.db.tombstones.clear();
        await this.db.quarantined_messages.clear();
        await this.db.settings.clear();
        await this.db.outbox.clear();
      },
    );
  }
}
