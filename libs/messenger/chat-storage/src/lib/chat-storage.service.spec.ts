// libs/messenger/chat-storage/src/lib/chat-storage.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { Dexie } from 'dexie';
import { MockProvider } from 'ng-mocks';
import { Logger } from '@nx-platform-application/console-logger';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { ChatStorageService } from './chat-storage.service';
import {
  DecryptedMessage,
  ConversationSyncState,
  MessageTombstone,
} from './chat.models';
import { MessengerDatabase } from './db/messenger.database';
import { ChatMergeStrategy } from './strategies/chat-merge.strategy';
import { ChatDeletionStrategy } from './strategies/chat-deletion.strategy';
import { ChatStorageMapper } from './db/chat-storage.mapper';
import 'fake-indexeddb/auto';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// --- Fixtures ---
const mockMyUrn = URN.parse('urn:contacts:user:me');
const mockPartnerUrn = URN.parse('urn:contacts:user:bob');

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
  typeId: URN.parse('urn:message:type:text'),
  payloadBytes: new TextEncoder().encode(text),
  status: status,
  conversationUrn: mockPartnerUrn,
});

describe('ChatStorageService', () => {
  let service: ChatStorageService;
  let db: MessengerDatabase;
  let mergeStrategy: ChatMergeStrategy;
  let deletionStrategy: ChatDeletionStrategy;

  beforeEach(async () => {
    // ⚠️ IMPORTANT: Reset DB for Zero-Day state
    await Dexie.delete('messenger');

    TestBed.configureTestingModule({
      providers: [
        ChatStorageService,
        MessengerDatabase,
        ChatStorageMapper, // Use Real Mapper for integration testing
        MockProvider(Logger),
        MockProvider(ChatMergeStrategy, {
          merge: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ChatDeletionStrategy, {
          deleteMessage: vi.fn().mockResolvedValue(undefined),
        }),
      ],
    });

    service = TestBed.inject(ChatStorageService);
    db = TestBed.inject(MessengerDatabase);
    mergeStrategy = TestBed.inject(ChatMergeStrategy);
    deletionStrategy = TestBed.inject(ChatDeletionStrategy);
    await db.open();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Write Path', () => {
    it('should save message AND upsert conversation index record', async () => {
      const msg = createMsg('m1', 'Hello Bob', '2024-01-01T10:00:00Z');
      await service.saveMessage(msg);

      // Verify Index Created via DB directly
      const index = await db.conversations.get(mockPartnerUrn.toString());
      expect(index).toBeTruthy();
      expect(index?.snippet).toBe('Hello Bob');
    });

    it('should increment unreadCount for received messages', async () => {
      // 1. Arrange: Existing conversation with 0 unread
      await db.conversations.put({
        conversationUrn: mockPartnerUrn.toString(),
        lastActivityTimestamp: '2024-01-01T09:00:00Z',
        snippet: 'Old',
        previewType: 'text',
        unreadCount: 0,
        genesisTimestamp: null,
        lastModified: '2024-01-01T09:00:00Z',
      });

      // 2. Act: Save new received message
      const msg = createMsg('m2', 'New', '2024-01-01T10:00:00Z', 'received');
      await service.saveMessage(msg);

      // 3. Assert
      const index = await db.conversations.get(mockPartnerUrn.toString());
      expect(index?.unreadCount).toBe(1);
    });
  });

  // ✅ NEW TEST SUITE FOR READ STATUS
  describe('Read Status (Unread Count)', () => {
    it('markConversationAsRead should reset unreadCount to 0', async () => {
      // 1. Arrange: Conversation with 5 unread messages
      await db.conversations.put({
        conversationUrn: mockPartnerUrn.toString(),
        lastActivityTimestamp: '2024-01-01T10:00:00Z',
        snippet: 'Pending...',
        previewType: 'text',
        unreadCount: 5,
        genesisTimestamp: null,
        lastModified: '2024-01-01T10:00:00Z',
      });

      // 2. Act
      await service.markConversationAsRead(mockPartnerUrn);

      // 3. Assert
      const index = await db.conversations.get(mockPartnerUrn.toString());
      expect(index?.unreadCount).toBe(0);
    });

    it('markConversationAsRead should do nothing if conversation does not exist', async () => {
      const ghostUrn = URN.parse('urn:contacts:user:ghost');
      await service.markConversationAsRead(ghostUrn);

      const index = await db.conversations.get(ghostUrn.toString());
      expect(index).toBeUndefined();
    });
  });

  describe('Read Path (Domain Mapping)', () => {
    it('getConversationIndex should return Domain Object (URNs)', async () => {
      // 1. Arrange: Insert Raw DB Record
      await db.conversations.put({
        conversationUrn: mockPartnerUrn.toString(),
        lastActivityTimestamp: '2024-01-01T10:00:00Z',
        snippet: 'Raw DB',
        previewType: 'text',
        unreadCount: 0,
        genesisTimestamp: null,
        lastModified: '2024-01-01T10:00:00Z',
      });

      // 2. Act
      const result = await service.getConversationIndex(mockPartnerUrn);

      // 3. Assert
      expect(result).toBeDefined();
      // ✅ Key Check: It should be a URN object, not a string
      expect(result?.conversationUrn).toBeInstanceOf(URN);
      expect(result?.conversationUrn.toString()).toBe(
        mockPartnerUrn.toString()
      );
    });

    it('getAllConversations should return array of Domain Objects', async () => {
      await db.conversations.put({
        conversationUrn: mockPartnerUrn.toString(),
        lastActivityTimestamp: '2024-01-01T10:00:00Z',
        snippet: 'Test',
        previewType: 'text',
        unreadCount: 0,
        genesisTimestamp: null,
        lastModified: '2024-01-01T10:00:00Z',
      });

      const results = await service.getAllConversations();
      expect(results.length).toBe(1);
      expect(results[0].conversationUrn).toBeInstanceOf(URN);
    });
  });

  describe('Sync Helpers (Tombstones)', () => {
    it('getTombstonesInRange should return Domain Objects', async () => {
      // 1. Arrange: DB has raw records
      await db.tombstones.put({
        messageId: 't1',
        conversationUrn: 'urn:contacts:user:bob',
        deletedAt: '2024-01-01T00:00:00Z',
      });

      // 2. Act
      const results = await service.getTombstonesInRange(
        '2023-12-31T00:00:00Z' as ISODateTimeString,
        '2024-01-02T00:00:00Z' as ISODateTimeString
      );

      // 3. Assert
      expect(results.length).toBe(1);
      expect(results[0].messageId).toBe('t1');
      // ✅ Check Domain Mapping
      expect(results[0].conversationUrn).toBeInstanceOf(URN);
    });
  });

  describe('Merge Logic (Anti-Corruption Layer)', () => {
    it('smartMergeConversations should map Domain Objects to DB Records before strategy', async () => {
      // 1. Input: Domain Objects
      const domainInput: ConversationSyncState[] = [
        {
          conversationUrn: mockPartnerUrn,
          lastActivityTimestamp: '2024-01-01T12:00:00Z' as ISODateTimeString,
          snippet: 'Cloud',
          unreadCount: 0,
          previewType: 'text',
          genesisTimestamp: null,
          lastModified: '2024-01-01T12:00:00Z' as ISODateTimeString,
        },
      ];

      // 2. Act
      await service.smartMergeConversations(domainInput);

      // 3. Assert
      expect(mergeStrategy.merge).toHaveBeenCalledTimes(1);
      const captureArg = (mergeStrategy.merge as any).mock.calls[0][0];

      // ✅ Verify the strategy received strings (DB Records), not URNs
      expect(typeof captureArg[0].conversationUrn).toBe('string');
      expect(captureArg[0].conversationUrn).toBe(mockPartnerUrn.toString());
    });
  });

  describe('Restored Functionality', () => {
    it('clearDatabase should wipe all tables including tombstones', async () => {
      await db.messages.put(
        service['mapper'].mapSmartToRecord(
          createMsg('m1', 'hi', '2024-01-01T10:00:00Z')
        )
      );
      await db.tombstones.put({
        messageId: 't1',
        conversationUrn: 'u1',
        deletedAt: '2024-01-01',
      });

      await service.clearDatabase();

      expect(await db.messages.count()).toBe(0);
      expect(await db.tombstones.count()).toBe(0);
    });

    it('setGenesisTimestamp should update existing record', async () => {
      await db.conversations.put({
        conversationUrn: mockPartnerUrn.toString(),
        lastActivityTimestamp: '2024-01-01T10:00:00Z',
        snippet: '',
        previewType: 'text',
        unreadCount: 0,
        genesisTimestamp: null,
        lastModified: '',
      });

      await service.setGenesisTimestamp(
        mockPartnerUrn,
        '2023-01-01T00:00:00Z' as ISODateTimeString
      );

      const updated = await db.conversations.get(mockPartnerUrn.toString());
      expect(updated?.genesisTimestamp).toBe('2023-01-01T00:00:00Z');
    });
  });
});
