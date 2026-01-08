import { TestBed } from '@angular/core/testing';
import { ChatStorageService } from './chat-storage.service';
import {
  MessengerDatabase,
  MessageMapper,
  ConversationMapper,
  DeletedMessageRecord,
} from '@nx-platform-application/messenger-infrastructure-db-schema';
import { ChatDeletionStrategy } from '../strategies/chat-deletion.strategy';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  MessageTombstone,
} from '@nx-platform-application/messenger-types';
import { MockProvider } from 'ng-mocks';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Dexie } from 'dexie';
import 'fake-indexeddb/auto';

describe('ChatStorageService', () => {
  let service: ChatStorageService;
  let db: MessengerDatabase;
  let deletionStrategy: ChatDeletionStrategy;

  const convUrn = URN.parse('urn:messenger:group:lisbon');

  // Helper to generate test messages quickly
  const createMsg = (
    id: string,
    sentTimestamp: string,
    text: string,
    status: 'sent' | 'received' = 'sent',
  ): ChatMessage => ({
    id,
    conversationUrn: convUrn,
    senderId: URN.parse('urn:contacts:user:me'),
    sentTimestamp: sentTimestamp as ISODateTimeString,
    // FIX: Explicitly set the Text Type URN so generateSnippet works
    typeId: URN.parse('urn:message:type:text'),
    payloadBytes: new TextEncoder().encode(text),
    status,
    tags: [],
  });

  beforeEach(async () => {
    // Crucial: Wipe DB before each test
    await Dexie.delete('messenger');

    TestBed.configureTestingModule({
      providers: [
        ChatStorageService,
        MessengerDatabase,
        MessageMapper,
        ConversationMapper,
        {
          provide: ChatDeletionStrategy,
          useValue: { deleteMessage: vi.fn() },
        },
      ],
    });

    service = TestBed.inject(ChatStorageService);
    db = TestBed.inject(MessengerDatabase);
    deletionStrategy = TestBed.inject(ChatDeletionStrategy);
    await db.open();
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  describe('HistoryReader Implementation', () => {
    it('should return messages filtered by history segment (Newest First)', async () => {
      await service.bulkSaveMessages([
        createMsg('m1', '2024-01-01T10:00:00Z', 'Oldest'),
        createMsg('m2', '2024-01-01T10:01:00Z', 'Middle'),
        createMsg('m3', '2024-01-01T10:02:00Z', 'Newest'),
      ]);

      // Request window ending strictly before m3 (should get m2, m1)
      // Limit 2
      const result = await service.getMessages({
        conversationUrn: convUrn,
        limit: 2,
        beforeTimestamp: '2024-01-01T10:02:00Z',
      });

      expect(result.messages).toHaveLength(2);

      // FIX: Expect Reverse Chronological (Newest -> Oldest)
      expect(result.messages[0].id).toBe('m2'); // Newer
      expect(result.messages[1].id).toBe('m1'); // Older
    });
  });

  describe('saveMessage (Write Path)', () => {
    it('should dual-write message and conversation index', async () => {
      const msg = createMsg('m1', '2025-01-01T10:00:00Z', 'Hello');
      await service.saveMessage(msg);

      // 1. Verify Message Table
      const storedMsg = await db.messages.get('m1');
      expect(storedMsg).toBeDefined();

      // 2. Verify Conversation Index
      const index = await db.conversations.get(convUrn.toString());
      expect(index).toBeDefined();
      expect(index?.snippet).toBe('Hello'); // Should pass now with correct typeId
      expect(index?.lastActivityTimestamp).toBe('2025-01-01T10:00:00Z');
    });

    it('should increment unread count for received messages', async () => {
      const msg = createMsg('m2', '2025-01-01T10:05:00Z', 'Hi', 'received');
      await service.saveMessage(msg);

      const index = await db.conversations.get(convUrn.toString());
      expect(index?.unreadCount).toBe(1);
    });
  });

  describe('Bulk Operations', () => {
    it('should handle bulk saves larger than the chunk limit (200)', async () => {
      const msgs = Array.from({ length: 250 }, (_, i) =>
        createMsg(`bulk-${i}`, '2025-01-01T00:00:00Z', `Msg ${i}`),
      );
      await service.bulkSaveMessages(msgs);
      const count = await db.messages.count();
      expect(count).toBe(250);
    });
  });

  describe('Cloud Sync Primitives', () => {
    it('getMessagesAfter should filter by sentTimestamp > cursor', async () => {
      await service.bulkSaveMessages([
        createMsg('old', '2020-01-01T00:00:00Z', 'Old'),
        createMsg('new', '2025-01-01T00:00:00Z', 'New'),
      ]);

      const result = await service.getMessagesAfter('2022-01-01T00:00:00Z');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('new');
    });

    it('getTombstonesAfter should filter by deletedAt > cursor', async () => {
      await db.tombstones.bulkPut([
        {
          messageId: 'old',
          deletedAt: '2020-01-01T00:00:00Z' as ISODateTimeString,
          conversationUrn: 'urn:messenger:group:1', // FIX: Valid 4-part URN
        },
        {
          messageId: 'new',
          deletedAt: '2025-01-01T00:00:00Z' as ISODateTimeString,
          conversationUrn: 'urn:messenger:group:1', // FIX: Valid 4-part URN
        },
      ]);

      const result = await service.getTombstonesAfter('2022-01-01T00:00:00Z');
      expect(result).toHaveLength(1);
      expect(result[0].messageId).toBe('new');
    });

    it('getMessagesInRange should filter by sentTimestamp', async () => {
      await service.bulkSaveMessages([
        createMsg('m1', '2025-01-01T10:00:00Z', 'A'),
        createMsg('m2', '2025-01-02T10:00:00Z', 'B'),
        createMsg('m3', '2025-01-03T10:00:00Z', 'C'),
      ]);

      const result = await service.getMessagesInRange(
        '2025-01-01T12:00:00Z',
        '2025-01-02T12:00:00Z',
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('m2');
    });

    it('getTombstonesInRange should filter by deletedAt', async () => {
      await db.tombstones.bulkPut([
        {
          messageId: 'm1',
          deletedAt: '2025-01-01T10:00:00Z' as ISODateTimeString,
          conversationUrn: 'urn:messenger:group:1',
        },
        {
          messageId: 'm2',
          deletedAt: '2025-01-02T10:00:00Z' as ISODateTimeString,
          conversationUrn: 'urn:messenger:group:1',
        },
      ]);

      const result = await service.getTombstonesInRange(
        '2025-01-01T12:00:00Z',
        '2025-01-02T12:00:00Z',
      );
      expect(result).toHaveLength(1);
      expect(result[0].messageId).toBe('m2');
    });

    it('bulkSaveTombstones should delete messages and write tombstones atomically', async () => {
      await service.saveMessage(createMsg('m1', '2025-01-01T00:00:00Z', 'Hi'));

      const tombstone: MessageTombstone = {
        messageId: 'm1',
        conversationUrn: convUrn,
        deletedAt: '2025-01-02T00:00:00Z' as ISODateTimeString,
      };

      await service.bulkSaveTombstones([tombstone]);

      // Message should be gone
      const msg = await db.messages.get('m1');
      expect(msg).toBeUndefined();

      // Tombstone should exist
      const ts = await db.tombstones.get('m1');
      expect(ts).toBeDefined();
    });
  });

  describe('Other Contracts', () => {
    it('should delete a single message via strategy', async () => {
      await service.deleteMessage('m1');
      expect(deletionStrategy.deleteMessage).toHaveBeenCalledWith('m1');
    });

    it('should retrieve conversation summaries', async () => {
      await db.conversations.put({
        conversationUrn: convUrn.toString(),
        lastActivityTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
        snippet: 'Summary Test',
        previewType: 'text',
        unreadCount: 2,
        genesisTimestamp: null,
        lastModified: '2025-01-01T12:00:00Z' as ISODateTimeString,
      });

      const summaries = await service.getConversationSummaries();
      expect(summaries).toHaveLength(1);
    });

    it('getMessage should return undefined for missing ID', async () => {
      const result = await service.getMessage('missing');
      expect(result).toBeUndefined();
    });
  });

  describe('Maintenance', () => {
    it('should prune tombstones older than a specific date', async () => {
      // FIX: Use valid 4-part URNs
      const ancient: DeletedMessageRecord = {
        messageId: 'old',
        deletedAt: '2020-01-01T00:00:00Z' as ISODateTimeString,
        conversationUrn: 'urn:messenger:group:1',
      };
      const recent: DeletedMessageRecord = {
        messageId: 'new',
        deletedAt: '2026-01-01T00:00:00Z' as ISODateTimeString,
        conversationUrn: 'urn:messenger:group:1',
      };

      await db.tombstones.bulkPut([ancient, recent]);

      // Prune anything before 2025
      const deletedCount = await service.pruneTombstones(
        '2025-01-01T00:00:00Z' as ISODateTimeString,
      );

      expect(deletedCount).toBe(1);

      const remaining = await db.tombstones.toArray();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].messageId).toBe('new');
    });
  });
});
