//libs/messenger/infrastructure/chat-storage/src/lib/strategies/chat-deletion.strategy.spec.ts
import { TestBed } from '@angular/core/testing';
import { Dexie } from 'dexie';
import { ChatDeletionStrategy } from './chat-deletion.strategy';
import {
  MessengerDatabase,
  MessageRecord,
} from '@nx-platform-application/messenger-infrastructure-indexed-db';
import { ISODateTimeString } from '@nx-platform-application/platform-types';
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ChatDeletionStrategy', () => {
  let strategy: ChatDeletionStrategy;
  let db: MessengerDatabase;

  const mockUrn = 'urn:contacts:user:bob';

  const createMsgRecord = (
    id: string,
    text: string,
    timestamp: string,
  ): MessageRecord => ({
    messageId: id,
    senderId: 'urn:me',
    recipientId: 'urn:bob',
    sentTimestamp: timestamp as ISODateTimeString,
    typeId: 'urn:message:type:text',
    payloadBytes: new TextEncoder().encode(text),
    // ✅ NEW: Populate snippet in test data
    snippet: text,
    status: 'sent',
    conversationUrn: mockUrn,
  });

  beforeEach(async () => {
    await Dexie.delete('messenger');

    TestBed.configureTestingModule({
      providers: [
        ChatDeletionStrategy,
        MessengerDatabase,
        // Removed MessageMapper mock as it's no longer used
      ],
    });

    strategy = TestBed.inject(ChatDeletionStrategy);
    db = TestBed.inject(MessengerDatabase);

    await db.open();
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  describe('deleteMessage', () => {
    it('should delete content and create a tombstone', async () => {
      await db.messages.put(
        createMsgRecord('m1', 'Delete Me', '2024-01-01T10:00:00Z'),
      );

      await strategy.deleteMessage('m1');

      const msg = await db.messages.get('m1');
      expect(msg).toBeUndefined();

      const tombstone = await db.tombstones.get('m1');
      expect(tombstone).toBeTruthy();
      expect(tombstone?.conversationUrn).toBe(mockUrn);
    });

    it('should ROLLBACK sidebar index if LATEST message is deleted', async () => {
      const oldMsg = createMsgRecord('m1', 'Previous', '2024-01-01T10:00:00Z');
      const newMsg = createMsgRecord('m2', 'Mistake', '2024-01-01T10:05:00Z');

      await db.messages.bulkPut([oldMsg, newMsg]);

      await db.conversations.put({
        conversationUrn: mockUrn,
        name: 'put conversation',
        lastActivityTimestamp: '2024-01-01T10:05:00Z' as ISODateTimeString,
        snippet: 'Mistake',
        unreadCount: 0,
        genesisTimestamp: null,
        lastModified: '' as ISODateTimeString,
      });

      // Act: Delete m2 (the newest message)
      await strategy.deleteMessage('m2');

      // Assert
      const index = await db.conversations.get(mockUrn);

      // Should roll back to the timestamp of m1
      expect(index?.lastActivityTimestamp).toBe('2024-01-01T10:00:00Z');

      // ✅ Verify snippet rolled back using the stored data (no parsing)
      expect(index?.snippet).toBe('Previous');
    });
  });
});
