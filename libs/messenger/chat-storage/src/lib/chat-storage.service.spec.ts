import { TestBed } from '@angular/core/testing';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { ChatStorageService } from './chat-storage.service';
import { DecryptedMessage } from './chat-storage.models';
import { MessengerDatabase } from './db/messenger.database';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';

// --- Fixtures ---
const mockMyUrn = URN.parse('urn:contacts:user:me');
const mockPartnerUrn = URN.parse('urn:contacts:user:bob');

// ✅ FIX: Use the correct namespace for Text Type
const createMsg = (
  id: string,
  text: string,
  timestamp: string,
  status: 'received' | 'sent' = 'received'
): DecryptedMessage => ({
  messageId: id,
  senderId: status === 'sent' ? mockMyUrn : mockPartnerUrn,
  recipientId: status === 'sent' ? mockPartnerUrn : mockMyUrn,
  sentTimestamp: timestamp as ISODateTimeString,
  // Correct URN namespace
  typeId: URN.parse('urn:message:type:text'),
  payloadBytes: new TextEncoder().encode(text),
  status: status,
  conversationUrn: mockPartnerUrn,
});

describe('ChatStorageService (Meta-Index)', () => {
  let service: ChatStorageService;
  let db: MessengerDatabase;

  beforeEach(async () => {
    await Dexie.delete('messenger');

    TestBed.configureTestingModule({
      providers: [ChatStorageService, MessengerDatabase, MockProvider(Logger)],
    });

    service = TestBed.inject(ChatStorageService);
    db = TestBed.inject(MessengerDatabase);
    await db.open();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Write Path (Dual-Write Transaction)', () => {
    it('should save message AND create conversation index record', async () => {
      const msg = createMsg('m1', 'Hello Bob', '2024-01-01T10:00:00Z');

      await service.saveMessage(msg);

      // 1. Verify Message Saved
      const savedMsg = await db.messages.get('m1');
      expect(savedMsg).toBeTruthy();

      // 2. Verify Index Created
      const index = await db.conversations.get(mockPartnerUrn.toString());
      expect(index).toBeTruthy();
      expect(index?.lastActivityTimestamp).toBe('2024-01-01T10:00:00Z');
      expect(index?.snippet).toBe('Hello Bob'); // Should now match
      expect(index?.unreadCount).toBe(1);
    });

    it('should update existing index with NEWER message', async () => {
      await service.saveMessage(createMsg('m1', 'Old', '2024-01-01T10:00:00Z'));
      await service.saveMessage(createMsg('m2', 'New', '2024-01-01T10:05:00Z'));

      const index = await db.conversations.get(mockPartnerUrn.toString());
      expect(index?.snippet).toBe('New'); // Should now match
      expect(index?.lastActivityTimestamp).toBe('2024-01-01T10:05:00Z');
      expect(index?.unreadCount).toBe(2);
    });

    it('should NOT update snippet if OLDER message arrives (Backfill)', async () => {
      await service.saveMessage(createMsg('m2', 'New', '2024-01-01T10:05:00Z'));
      await service.saveMessage(createMsg('m1', 'Old', '2024-01-01T10:00:00Z'));

      const index = await db.conversations.get(mockPartnerUrn.toString());
      expect(index?.snippet).toBe('New'); // Should now match
      expect(index?.lastActivityTimestamp).toBe('2024-01-01T10:05:00Z');
    });
  });

  describe('Read Path (Optimized Inbox)', () => {
    it('should load summaries ONLY from the conversation table', async () => {
      await db.conversations.bulkPut([
        {
          conversationUrn: 'urn:contacts:user:alice',
          lastActivityTimestamp: '2024-01-02T00:00:00Z',
          snippet: 'Alice Msg',
          previewType: 'text',
          unreadCount: 0,
          genesisTimestamp: null,
          lastModified: '',
        },
        {
          conversationUrn: 'urn:contacts:user:zara',
          lastActivityTimestamp: '2024-01-01T00:00:00Z',
          snippet: 'Zara Msg',
          previewType: 'text',
          unreadCount: 5,
          genesisTimestamp: null,
          lastModified: '',
        },
      ]);

      const summaries = await service.loadConversationSummaries();
      expect(summaries.length).toBe(2);
      expect(summaries[0].conversationUrn.toString()).toBe(
        'urn:contacts:user:alice'
      );
    });
  });

  describe('Genesis Logic (Scroll Boundaries)', () => {
    it('should set genesis timestamp on the index record', async () => {
      await service.saveMessage(createMsg('m1', 'Hi', '2024-01-01T10:00:00Z'));
      await service.setGenesisTimestamp(
        mockPartnerUrn,
        '2023-01-01T00:00:00Z' as ISODateTimeString
      );
      const index = await db.conversations.get(mockPartnerUrn.toString());
      expect(index?.genesisTimestamp).toBe('2023-01-01T00:00:00Z');
    });
  });
});
