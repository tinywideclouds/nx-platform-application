import { TestBed } from '@angular/core/testing';
import { Dexie } from 'dexie';
import { ChatDeletionStrategy } from './chat-deletion.strategy';
import { MessengerDatabase } from '../db/messenger.database';
import { MessageRecord } from '../db/chat-storage.models';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { ChatStorageService } from '../chat-storage.service';
import { MockProvider } from 'ng-mocks';
import 'fake-indexeddb/auto';
import { vi } from 'vitest'; // Ensure vi is imported if using Vitest

describe('ChatDeletionStrategy', () => {
  let strategy: ChatDeletionStrategy;
  let db: MessengerDatabase;
  let mockStorageService: ChatStorageService;

  // --- Fixtures ---
  const mockUrn = 'urn:contacts:user:bob';

  const createMsgRecord = (
    id: string,
    text: string,
    timestamp: string
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

    // Create a mock implementation for the dependencies needed by the strategy
    const mockMsgRecord: MessageRecord = createMsgRecord(
      'dummy',
      'test',
      '2024-01-01T00:00:00Z'
    );

    // Mock the smart object output for the mapper result
    const mockDecryptedMessage: any = {
      ...mockMsgRecord,
      senderId: URN.parse(mockMsgRecord.senderId),
      conversationUrn: URN.parse(mockMsgRecord.conversationUrn),
    };

    TestBed.configureTestingModule({
      providers: [
        ChatDeletionStrategy,
        MessengerDatabase,
        // Removed ChatStorageMapper mock as the strategy only uses the service
        MockProvider(ChatStorageService, {
          // The strategy maps the PREVIOUS message, so mapRecordToSmart is called once
          mapRecordToSmart: vi.fn().mockReturnValue(mockDecryptedMessage),
          // The snippet/type generation for the PREVIOUS message is also delegated
          generateSnippet: vi.fn().mockReturnValue('Previous'), // Matches the expectation in the test
          getPreviewType: vi.fn().mockReturnValue('text'),
        }),
      ],
    });

    strategy = TestBed.inject(ChatDeletionStrategy);
    db = TestBed.inject(MessengerDatabase);
    mockStorageService = TestBed.inject(ChatStorageService);

    await db.open();
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  describe('deleteMessage', () => {
    it('should delete content and create a tombstone', async () => {
      // 1. Arrange
      await db.messages.put(
        createMsgRecord('m1', 'Delete Me', '2024-01-01T10:00:00Z')
      );

      // 2. Act
      await strategy.deleteMessage(mockStorageService, 'm1');

      // 3. Assert
      const msg = await db.messages.get('m1');
      expect(msg).toBeUndefined();

      const tombstone = await db.tombstones.get('m1');
      expect(tombstone).toBeTruthy();
      expect(tombstone?.conversationUrn).toBe(mockUrn);
      // The strategy sets deletedAt to a new date, so we only check existence
      expect(tombstone?.deletedAt).toBeDefined();
    });

    it('should ROLLBACK sidebar index if LATEST message is deleted', async () => {
      // 1. Arrange: Chat with 2 messages
      const oldMsg = createMsgRecord('m1', 'Previous', '2024-01-01T10:00:00Z');
      const newMsg = createMsgRecord('m2', 'Mistake', '2024-01-01T10:05:00Z');

      await db.messages.bulkPut([oldMsg, newMsg]);

      // Setup the Index to point to 'Mistake'
      await db.conversations.put({
        conversationUrn: mockUrn,
        lastActivityTimestamp: '2024-01-01T10:05:00Z', // Matches m2
        snippet: 'Mistake',
        previewType: 'text',
        unreadCount: 0,
        genesisTimestamp: null,
        lastModified: '',
      });

      // 2. Act: Delete m2 (Head)
      // The mock returns 'Previous' as the new snippet
      await strategy.deleteMessage(mockStorageService, 'm2');

      // 3. Assert: Index should point to m1
      const index = await db.conversations.get(mockUrn);
      expect(index?.snippet).toBe('Previous');
      expect(index?.lastActivityTimestamp).toBe('2024-01-01T10:00:00Z');

      // Verify the central mapper/helper were used
      // It should have mapped the previous message (m1)
      expect(mockStorageService.mapRecordToSmart).toHaveBeenCalled();
      expect(mockStorageService.generateSnippet).toHaveBeenCalled();
    });

    it('should NOT rollback index if an OLDER message is deleted', async () => {
      // 1. Arrange
      const oldMsg = createMsgRecord('m1', 'Mistake', '2024-01-01T10:00:00Z');
      const newMsg = createMsgRecord('m2', 'Latest', '2024-01-01T10:05:00Z');

      await db.messages.bulkPut([oldMsg, newMsg]);
      await db.conversations.put({
        conversationUrn: mockUrn,
        lastActivityTimestamp: '2024-01-01T10:05:00Z', // Matches m2
        snippet: 'Latest',
        previewType: 'text',
        unreadCount: 0,
        genesisTimestamp: null,
        lastModified: '',
      });

      // 2. Act: Delete m1 (Old)
      await strategy.deleteMessage(mockStorageService, 'm1');

      // 3. Assert: Index stays on m2
      const index = await db.conversations.get(mockUrn);
      expect(index?.snippet).toBe('Latest');
      expect(index?.lastActivityTimestamp).toBe('2024-01-01T10:05:00Z');
      // Verify that the rollback logic was skipped
      expect(mockStorageService.mapRecordToSmart).not.toHaveBeenCalled();
    });
  });
});
