import { TestBed } from '@angular/core/testing';
import { Temporal } from '@js-temporal/polyfill';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { ChatStorageService } from './chat-storage.service';
import { DecryptedMessage } from './chat-storage.models';
import { MessengerDatabase } from './db/messenger.database';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import 'fake-indexeddb/auto'; // ✅ Key: Use In-Memory DB logic
import { Dexie } from 'dexie';

// --- Fixtures ---
const mockSenderUrn = URN.parse('urn:sm:user:sender');
const mockRecipientUrn = URN.parse('urn:sm:user:recipient');
const mockConvoUrn = mockRecipientUrn;

const createMessage = (id: string, timestamp: string): DecryptedMessage => ({
  messageId: id,
  senderId: mockSenderUrn,
  recipientId: mockRecipientUrn,
  sentTimestamp: timestamp as ISODateTimeString,
  typeId: URN.parse('urn:sm:type:text'),
  payloadBytes: new TextEncoder().encode('Hello'),
  status: 'received',
  conversationUrn: mockConvoUrn,
});

describe('ChatStorageService', () => {
  let service: ChatStorageService;
  let db: MessengerDatabase;

  beforeEach(async () => {
    // Reset DB state
    await Dexie.delete('messenger');

    TestBed.configureTestingModule({
      providers: [
        ChatStorageService,
        MessengerDatabase, // Use REAL database class
        MockProvider(Logger), // Use MOCK Logger
      ],
    });

    service = TestBed.inject(ChatStorageService);
    db = TestBed.inject(MessengerDatabase);

    // Ensure DB is open and tables exist
    await db.open();
  });

  afterEach(async () => {
    await db.close();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Basic CRUD', () => {
    it('should save and load a message', async () => {
      const msg = createMessage('m1', '2023-01-01T10:00:00Z');

      await service.saveMessage(msg);

      const history = await service.loadHistory(mockConvoUrn);
      expect(history.length).toBe(1);
      expect(history[0].messageId).toBe('m1');
      // Verify URN reconstruction
      expect(history[0].conversationUrn.toString()).toBe(
        mockConvoUrn.toString()
      );
    });

    it('should clear database', async () => {
      await service.saveMessage(createMessage('m1', '2023-01-01T10:00:00Z'));
      await service.setCloudEnabled(true);

      await service.clearDatabase();

      const count = await db.messages.count();
      const settingsCount = await db.settings.count();

      expect(count).toBe(0);
      expect(settingsCount).toBe(0);
    });
  });

  describe('History & Paging (Complex Queries)', () => {
    // Setup helper
    const setupMessages = async () => {
      // Create 5 messages spaced 1 hour apart
      // 10:00, 11:00, 12:00, 13:00, 14:00
      const msgs = [
        createMessage('m1', '2023-01-01T10:00:00Z'),
        createMessage('m2', '2023-01-01T11:00:00Z'),
        createMessage('m3', '2023-01-01T12:00:00Z'),
        createMessage('m4', '2023-01-01T13:00:00Z'),
        createMessage('m5', '2023-01-01T14:00:00Z'),
      ];
      await service.bulkSaveMessages(msgs);
    };

    it('should fetch latest N messages (descending)', async () => {
      await setupMessages();

      // Fetch latest 3
      const result = await service.loadHistorySegment(mockConvoUrn, 3);

      expect(result.length).toBe(3);
      // "Newest First" logic in service?
      // The service code says: .reverse() (Dexie) -> .reverse() (Array map)
      // Let's verify the actual output order.
      // Usually UI wants [Oldest -> Newest] for appending to bottom.

      // m5 (14:00), m4 (13:00), m3 (12:00) are the latest 3.
      // If result is chronological: m3, m4, m5
      expect(result[0].messageId).toBe('m3');
      expect(result[2].messageId).toBe('m5');
    });

    it('should support pagination via cursor (beforeTimestamp)', async () => {
      await setupMessages();

      // Cursor is m3 (12:00). We want messages OLDER than 12:00.
      // Expect: m2 (11:00), m1 (10:00)
      const cursor = '2023-01-01T12:00:00Z' as ISODateTimeString;

      const result = await service.loadHistorySegment(mockConvoUrn, 5, cursor);

      expect(result.length).toBe(2);
      expect(result[0].messageId).toBe('m1'); // 10:00
      expect(result[1].messageId).toBe('m2'); // 11:00
    });

    // Add this to the 'History & Paging' or a new 'Summaries' describe block in chat-storage.service.spec.ts

    it('REPRO: loadConversationSummaries should return the LATEST message, not the oldest', async () => {
      // 1. Insert 3 messages: Old, Middle, New
      const msgs = [
        createMessage('msg-old', '2023-01-01T10:00:00Z'),
        createMessage('msg-mid', '2023-01-01T11:00:00Z'),
        createMessage('msg-new', '2023-01-01T12:00:00Z'),
      ];

      // Override payloads to identify them easily
      msgs[0].payloadBytes = new TextEncoder().encode('OLD');
      msgs[1].payloadBytes = new TextEncoder().encode('MID');
      msgs[2].payloadBytes = new TextEncoder().encode('NEW');

      await service.bulkSaveMessages(msgs);

      // 2. Fetch Summaries
      const summaries = await service.loadConversationSummaries();

      // 3. Assert
      expect(summaries.length).toBe(1);
      // BUG EXPECTATION: If the bug exists, this might be 'OLD'.
      // CORRECT BEHAVIOR: It should be 'NEW'.
      expect(summaries[0].latestSnippet).toBe('NEW');
    });
  });

  describe('Smart Export (Range Queries)', () => {
    it('should fetch strictly within range', async () => {
      // 01-01, 02-01, 03-01
      const msgs = [
        createMessage('jan', '2023-01-15T00:00:00Z'),
        createMessage('feb', '2023-02-15T00:00:00Z'),
        createMessage('mar', '2023-03-15T00:00:00Z'),
      ];
      await service.bulkSaveMessages(msgs);

      // Query February only
      const result = await service.getMessagesInRange(
        '2023-02-01T00:00:00Z' as ISODateTimeString,
        '2023-02-28T23:59:59Z' as ISODateTimeString
      );

      expect(result.length).toBe(1);
      expect(result[0].messageId).toBe('feb');
    });

    it('should return null min/max for empty db', async () => {
      const range = await service.getDataRange();
      expect(range.min).toBeNull();
      expect(range.max).toBeNull();
    });
  });

  describe('Settings & Metadata', () => {
    it('should persist cloud enabled flag', async () => {
      expect(await service.isCloudEnabled()).toBe(false); // Default

      await service.setCloudEnabled(true);
      expect(await service.isCloudEnabled()).toBe(true);

      await service.setCloudEnabled(false);
      expect(await service.isCloudEnabled()).toBe(false);
    });

    it('should save genesis markers', async () => {
      const genesis = '2020-01-01T00:00:00Z' as ISODateTimeString;
      await service.setGenesisTimestamp(mockConvoUrn, genesis);

      const meta = await service.getConversationMetadata(mockConvoUrn);
      expect(meta?.genesisTimestamp).toBe(genesis);
    });
  });
});
