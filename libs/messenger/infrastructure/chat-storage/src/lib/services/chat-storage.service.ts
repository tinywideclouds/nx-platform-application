import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { Dexie } from 'dexie';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  MessageDeliveryStatus,
  Conversation,
  MessageTombstone,
} from '@nx-platform-application/messenger-types';

import {
  MessengerDatabase,
  MessageMapper,
  ConversationMapper,
  ConversationIndexRecord,
  DeletedMessageRecord,
} from '@nx-platform-application/messenger-infrastructure-indexed-db';

import { ChatDeletionStrategy } from '../strategies/chat-deletion.strategy';
import { HistoryReader, HistoryQuery, HistoryResult } from '../history.reader';
import { MessageWriter } from '../message.writer';
import { ConversationStorage } from '../conversation.storage';

const BULK_SAVE_CHUNK_SIZE = 200;

@Injectable({ providedIn: 'root' })
export class ChatStorageService
  implements HistoryReader, MessageWriter, ConversationStorage
{
  private logger = inject(Logger);
  private readonly db = inject(MessengerDatabase);
  private readonly deletionStrategy = inject(ChatDeletionStrategy);
  private readonly messageMapper = inject(MessageMapper);
  private readonly conversationMapper = inject(ConversationMapper);

  // --- IDENTITY & LIFECYCLE ---

  async startConversation(urn: URN, name: string): Promise<void> {
    const urnStr = urn.toString();
    const now = Temporal.Now.instant().toString() as ISODateTimeString;

    await this.db.transaction('rw', [this.db.conversations], async () => {
      const existing = await this.db.conversations.get(urnStr);

      const record: ConversationIndexRecord = {
        conversationUrn: urnStr,
        name: name,
        lastActivityTimestamp: existing?.lastActivityTimestamp ?? now,
        snippet: existing?.snippet ?? '',
        unreadCount: existing?.unreadCount ?? 0,
        genesisTimestamp: existing?.genesisTimestamp ?? null,
        lastModified: now,
      };

      await this.db.conversations.put(record);
    });
  }

  async renameConversation(urn: URN, name: string): Promise<void> {
    return this.startConversation(urn, name);
  }

  async conversationExists(urn: URN): Promise<boolean> {
    const conversationUrnStr = urn.toString();
    const count = await this.db.conversations
      .where('conversationUrn')
      .equals(conversationUrnStr)
      .count();
    return count > 0;
  }

  // --- RETRIEVAL ---

  async getConversation(urn: URN): Promise<Conversation | undefined> {
    const record = await this.db.conversations.get(urn.toString());
    if (!record) return undefined;
    return this.conversationMapper.toDomain(record);
  }

  async getAllConversations(): Promise<Conversation[]> {
    const records = await this.db.conversations
      .orderBy('lastActivityTimestamp')
      .reverse()
      .toArray();

    return records.map((r) => this.conversationMapper.toDomain(r));
  }

  async getMessage(id: string): Promise<ChatMessage | undefined> {
    const record = await this.db.messages.get(id);
    if (!record) return undefined;
    return this.messageMapper.toDomain(record);
  }

  // --- HISTORY READER ---

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

  // --- PERSISTENCE ---

  async saveMessage(message: ChatMessage): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.conversations],
      async () => {
        await this.saveInternal(message);
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

  async bulkSaveConversations(conversations: Conversation[]): Promise<void> {
    const records = conversations.map((c) =>
      this.conversationMapper.toRecord(c),
    );
    await this.db.conversations.bulkPut(records);
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

    const name = existing?.name ? existing.name : 'unknown';

    const update: ConversationIndexRecord = existing || {
      name,
      conversationUrn: conversationUrnStr,
      lastActivityTimestamp: sentTime,
      snippet: '',
      unreadCount: 0,
      lastModified: now,
      genesisTimestamp: null,
    };

    update.lastModified = now;

    if (isNewer) {
      update.lastActivityTimestamp = sentTime;
      update.snippet = message.snippet || 'unknown';
      if (message.status === 'received') {
        update.unreadCount = (existing?.unreadCount || 0) + 1;
      }
    }

    if (isOlder) {
      update.genesisTimestamp = sentTime;
    }

    await this.db.conversations.put(update);
  }

  // --- STATUS & RECEIPTS ---

  async markConversationAsRead(conversationUrn: URN): Promise<void> {
    await this.db.conversations.update(conversationUrn.toString(), {
      unreadCount: 0,
    });
  }

  async markMessagesAsRead(
    conversationUrn: URN,
    messageIds: string[],
  ): Promise<void> {
    const urnStr = conversationUrn.toString();

    // ✅ ATOMIC TRANSACTION
    // Locks both tables so the UI never sees a partial state.
    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.conversations],
      async () => {
        // 1. Update the specific messages to 'read'
        // (Using Promise.all because Dexie bulkUpdate is strictly for keys)
        await Promise.all(
          messageIds.map((id) =>
            this.db.messages.update(id, { status: 'read' }),
          ),
        );

        // 2. The Truth Check
        // Count how many 'received' (unread) messages remain for this chat.
        const realCount = await this.db.messages
          .where('conversationUrn')
          .equals(urnStr)
          .filter((m) => m.status === 'received')
          .count();

        // 3. Update the Aggregate
        // The Sidebar listens to this specific field.
        await this.db.conversations.update(urnStr, { unreadCount: realCount });
      },
    );
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

        if (!record) {
          this.logger.warn(
            '[apply receipt] id does not match existing record',
            messageId,
          );
          return;
        }

        const domainMsg = this.messageMapper.toDomain(record);

        console.log('applying receipt to existing message', domainMsg);
        if (!domainMsg.receiptMap) {
          domainMsg.receiptMap = {};
        }

        let newGlobalStatus = domainMsg.status;

        if (domainMsg.receiptMap) {
          domainMsg.receiptMap[readerUrn.toString()] = status;
          const values = Object.values(domainMsg.receiptMap);
          if (values.length > 0) {
            if (values.every((s) => s === 'read')) newGlobalStatus = 'read';
            else if (
              values.every((s) => ['read', 'received', 'delivered'].includes(s))
            ) {
              newGlobalStatus = 'delivered';
            }
          }
        }

        domainMsg.status = newGlobalStatus;
        await this.saveInternal(domainMsg);

        console.log('receipt applied: ', domainMsg);

        if (newGlobalStatus) {
          const ghostTag = `urn:messenger:ghost-of:${messageId}`;
          await this.db.messages
            .where('tags')
            .equals(ghostTag)
            .modify({ status: newGlobalStatus });
        }
      },
    );
  }

  // --- DELETION ---

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

  async bulkSaveTombstones(tombstones: MessageTombstone[]): Promise<void> {
    if (tombstones.length === 0) return;
    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.tombstones],
      async () => {
        const records: DeletedMessageRecord[] = tombstones.map((t) => ({
          messageId: t.messageId,
          conversationUrn: t.conversationUrn.toString(),
          deletedAt: t.deletedAt as ISODateTimeString,
        }));
        await this.db.tombstones.bulkPut(records);
        const ids = tombstones.map((t) => t.messageId);
        await this.db.messages.bulkDelete(ids);
      },
    );
  }

  async pruneTombstones(olderThan: ISODateTimeString): Promise<number> {
    return await this.db.tombstones
      .where('deletedAt')
      .below(olderThan)
      .delete();
  }

  // --- CLOUD SYNC & HELPERS ---

  async setGenesisTimestamp(
    urn: URN,
    timestamp: ISODateTimeString,
  ): Promise<void> {
    await this.db.conversations.update(urn.toString(), {
      genesisTimestamp: timestamp,
    });
  }

  async getDataRange(): Promise<{ min: string; max: string } | null> {
    const first = await this.db.messages.orderBy('sentTimestamp').first();
    const last = await this.db.messages.orderBy('sentTimestamp').last();
    if (!first || !last) return null;
    return { min: first.sentTimestamp, max: last.sentTimestamp };
  }

  async getMessagesAfter(isoDate: string): Promise<ChatMessage[]> {
    const records = await this.db.messages
      .where('sentTimestamp')
      .above(isoDate)
      .toArray();
    return records.map((r) => this.messageMapper.toDomain(r));
  }

  async getTombstonesAfter(isoDate: string): Promise<MessageTombstone[]> {
    const records = await this.db.tombstones
      .where('deletedAt')
      .above(isoDate)
      .toArray();
    return records.map((r) => ({
      messageId: r.messageId,
      conversationUrn: URN.parse(r.conversationUrn),
      deletedAt: r.deletedAt,
    }));
  }

  // ✅ RESTORED: Critical for Cloud Sync (Range Sync)
  async getMessagesInRange(start: string, end: string): Promise<ChatMessage[]> {
    const records = await this.db.messages
      .where('sentTimestamp')
      .between(start, end)
      .toArray();
    return records.map((r) => this.messageMapper.toDomain(r));
  }

  // ✅ RESTORED: Critical for Cloud Sync (Range Sync)
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

  async updateMessagePayload(
    messageId: string,
    newBytes: Uint8Array,
  ): Promise<void> {
    await this.db.messages.update(messageId, { payloadBytes: newBytes });
  }

  // --- SETTINGS & ADMIN ---

  async setCloudEnabled(enabled: boolean): Promise<void> {
    await this.db.settings.put({ key: 'cloud_enabled', value: enabled });
  }

  async isCloudEnabled(): Promise<boolean> {
    const setting = await this.db.settings.get('cloud_enabled');
    return setting?.value ?? false;
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
