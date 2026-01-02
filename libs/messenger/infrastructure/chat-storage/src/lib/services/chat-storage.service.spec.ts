//libs/messenger/infrastructure/chat-storage/src/lib/services/chat-storage.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { ChatStorageService } from './chat-storage.service';
import {
  MessengerDatabase,
  MessageMapper,
  ConversationMapper,
} from '@nx-platform-application/messenger-infrastructure-db-schema';
import { ChatDeletionStrategy } from '../strategies/chat-deletion.strategy';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
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
    time: string,
    text: string,
    status: 'sent' | 'received' = 'sent',
  ): ChatMessage => ({
    id,
    conversationUrn: convUrn,
    senderId: URN.parse(
      status === 'sent' ? 'urn:contacts:user:me' : 'urn:contacts:user:other',
    ),
    sentTimestamp: time as ISODateTimeString,
    typeId: URN.parse('urn:message:type:text'),
    payloadBytes: new TextEncoder().encode(text),
    status,
    tags: [],
    textContent: undefined,
  });

  beforeEach(async () => {
    await Dexie.delete('messenger');

    TestBed.configureTestingModule({
      providers: [
        ChatStorageService,
        MessengerDatabase,
        MessageMapper,
        ConversationMapper,
        MockProvider(ChatDeletionStrategy, {
          deleteMessage: vi.fn().mockResolvedValue(undefined),
        }),
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

  describe('Logic: Dual-Write (Message + Index)', () => {
    it('should save message and update conversation snippet', async () => {
      const msg = createMsg('m1', '2025-01-01T12:00:00Z', 'Hello World');
      await service.saveMessage(msg);

      // Verify Message Table
      const storedMsg = await db.messages.get('m1');
      expect(storedMsg).toBeDefined();

      // Verify Conversation Index (Snippet Update)
      const summary = await service.getConversationIndex(convUrn);
      expect(summary?.snippet).toBe('Hello World');
      expect(summary?.lastActivityTimestamp).toBe('2025-01-01T12:00:00Z');
    });
  });

  describe('Logic: Unread Counts', () => {
    it('should increment unread count ONLY for received messages', async () => {
      // 1. Receive a message -> Count 1
      await service.saveMessage(
        createMsg('m1', '2025-01-01T10:00:00Z', 'Hi', 'received'),
      );
      let index = await service.getConversationIndex(convUrn);
      expect(index?.unreadCount).toBe(1);

      // 2. Receive another -> Count 2
      await service.saveMessage(
        createMsg('m2', '2025-01-01T10:01:00Z', 'Hru?', 'received'),
      );
      index = await service.getConversationIndex(convUrn);
      expect(index?.unreadCount).toBe(2);

      // 3. Send a reply -> Count should stay 2 (Sent messages don't increment)
      await service.saveMessage(
        createMsg('m3', '2025-01-01T10:02:00Z', 'Good', 'sent'),
      );
      index = await service.getConversationIndex(convUrn);
      expect(index?.unreadCount).toBe(2);
      expect(index?.snippet).toBe('Good'); // Snippet should still update
    });

    it('should reset unread count when marked as read', async () => {
      await service.saveMessage(
        createMsg('m1', '2025-01-01T10:00:00Z', 'Hi', 'received'),
      );

      await service.markConversationAsRead(convUrn);

      const index = await service.getConversationIndex(convUrn);
      expect(index?.unreadCount).toBe(0);
    });
  });

  describe('Logic: Backfill & Ordering', () => {
    it('should update genesisTimestamp but PRESERVE snippet when inserting older messages', async () => {
      // 1. Save LATEST message first (Simulate live chat)
      await service.saveMessage(
        createMsg('new', '2025-01-01T12:00:00Z', 'Latest'),
      );

      // 2. Insert OLDER message (Simulate history sync/scroll back)
      await service.saveMessage(
        createMsg('old', '2025-01-01T08:00:00Z', 'Ancient'),
      );

      const index = await service.getConversationIndex(convUrn);

      // Expect: Snippet remains "Latest", Genesis becomes "Ancient" time
      expect(index?.snippet).toBe('Latest');
      expect(index?.lastActivityTimestamp).toBe('2025-01-01T12:00:00Z');
      expect(index?.genesisTimestamp).toBe('2025-01-01T08:00:00Z');
    });
  });

  describe('Logic: Bulk Operations', () => {
    it('should handle bulk saves larger than the chunk limit (200)', async () => {
      // Generate 250 messages to force >1 chunk execution
      const messages = Array.from({ length: 250 }, (_, i) =>
        createMsg(`bulk-${i}`, `2025-01-01T12:00:00.${i}Z`, `Msg ${i}`),
      );

      await service.bulkSaveMessages(messages);

      const count = await db.messages.count();
      expect(count).toBe(250);

      // Verify one random message exists
      const randomMsg = await db.messages.get('bulk-249');
      expect(randomMsg).toBeDefined();
    });
  });

  describe('Queries & Deletion', () => {
    it('should filter messages by range', async () => {
      await service.saveMessage(createMsg('m1', '2025-01-01T10:00:00Z', 'A'));
      await service.saveMessage(createMsg('m2', '2025-01-01T11:00:00Z', 'B'));
      await service.saveMessage(createMsg('m3', '2025-01-01T12:00:00Z', 'C'));

      // Query middle range
      const results = await service.getMessagesInRange(
        '2025-01-01T10:30:00Z',
        '2025-01-01T11:30:00Z',
      );

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('m2');
    });

    it('should delegate deletion to strategy', async () => {
      await service.deleteMessage('m1');
      expect(deletionStrategy.deleteMessage).toHaveBeenCalledWith('m1');
    });
  });
});
