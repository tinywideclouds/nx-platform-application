//libs/messenger/infrastructure/chat-storage/src/lib/strategies/chat-deletion.strategy.spec.ts
import { TestBed } from '@angular/core/testing';
import { Dexie } from 'dexie';
import { ChatDeletionStrategy } from './chat-deletion.strategy';
import {
  MessengerDatabase,
  MessageRecord,
  MessageMapper,
} from '@nx-platform-application/messenger-infrastructure-db-schema';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MockProvider } from 'ng-mocks';
import 'fake-indexeddb/auto';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ChatDeletionStrategy', () => {
  let strategy: ChatDeletionStrategy;
  let db: MessengerDatabase;
  let mapper: MessageMapper;

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
    status: 'sent',
    conversationUrn: mockUrn,
  });

  beforeEach(async () => {
    await Dexie.delete('messenger');

    // Partial mock of a domain message for the mapper return value
    const mockDomainMsg: Partial<ChatMessage> = {
      typeId: URN.parse('urn:message:type:text'),
      payloadBytes: new TextEncoder().encode('Previous'),
      textContent: 'Previous',
    };

    TestBed.configureTestingModule({
      providers: [
        ChatDeletionStrategy,
        MessengerDatabase,
        MockProvider(MessageMapper, {
          toDomain: vi.fn().mockReturnValue(mockDomainMsg),
        }),
      ],
    });

    strategy = TestBed.inject(ChatDeletionStrategy);
    db = TestBed.inject(MessengerDatabase);
    mapper = TestBed.inject(MessageMapper);

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
        lastActivityTimestamp: '2024-01-01T10:05:00Z' as ISODateTimeString,
        snippet: 'Mistake',
        previewType: 'text',
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

      // Verify mapper was used to generate the new snippet
      expect(mapper.toDomain).toHaveBeenCalled();
    });
  });
});
