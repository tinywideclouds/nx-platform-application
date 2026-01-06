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

import { HistoryReader, HistoryQuery, HistoryResult } from '../history.reader';

import { ConversationStorage } from '../conversation.storage';

const BULK_SAVE_CHUNK_SIZE = 200;

@Injectable({ providedIn: 'root' })
export class ChatStorageService implements HistoryReader, ConversationStorage {
  private readonly db = inject(MessengerDatabase);
  private readonly deletionStrategy = inject(ChatDeletionStrategy);
  private readonly messageMapper = inject(MessageMapper);
  private readonly conversationMapper = inject(ConversationMapper);

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

  // ✅ NEW: Hybrid Receipt Logic
  async applyReceipt(
    messageId: string,
    readerUrn: URN,
    status: MessageDeliveryStatus,
  ): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.conversations],
      async () => {
        const record = await this.db.messages.get(messageId);
        if (!record) return;

        const domainMsg = this.messageMapper.toDomain(record);

        if (domainMsg.receiptMap) {
          // === MODE A: High Fidelity (Tier 1 & 2) ===
          domainMsg.receiptMap[readerUrn.toString()] = status;

          const values = Object.values(domainMsg.receiptMap);
          if (values.length > 0) {
            if (values.every((s) => s === 'read')) {
              domainMsg.status = 'read';
            } else if (
              values.every(
                (s) => s === 'read' || s === 'received' || s === 'delivered',
              )
            ) {
              domainMsg.status = 'delivered';
            }
          }
        } else {
          // === MODE B: Low Fidelity (Tier 3) ===
          // Binary "High Water Mark" Logic
          if (status === 'read') {
            domainMsg.status = 'read';
          } else if (status === 'delivered' && domainMsg.status !== 'read') {
            domainMsg.status = 'delivered';
          }
        }

        await this.saveInternal(domainMsg);
      },
    );
  }

  async bulkSaveMessages(messages: ChatMessage[]): Promise<void> {
    for (let i = 0; i < messages.length; i += BULK_SAVE_CHUNK_SIZE) {
      const chunk = messages.slice(i, i + BULK_SAVE_CHUNK_SIZE);

      await this.db.transaction(
        'rw',
        [this.db.messages, this.db.conversations],
        async () => {
          for (const msg of chunk) {
            await this.saveInternal(msg);
          }
        },
      );
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

  async saveMessage(message: ChatMessage): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.conversations],
      async () => {
        await this.saveInternal(message);
      },
    );
  }

  private async saveInternal(message: ChatMessage): Promise<void> {
    const record = this.messageMapper.toRecord(message);
    const conversationUrnStr = message.conversationUrn.toString();
    const sentTime = message.sentTimestamp;

    await this.db.messages.put(record);

    const existing = await this.db.conversations.get(conversationUrnStr);
    const now = Temporal.Now.instant().toString() as ISODateTimeString;

    const isNewer = !existing || sentTime >= existing.lastActivityTimestamp;
    const currentGenesis =
      existing?.genesisTimestamp ?? existing?.lastActivityTimestamp ?? sentTime;
    const isOlder = sentTime < currentGenesis;

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
