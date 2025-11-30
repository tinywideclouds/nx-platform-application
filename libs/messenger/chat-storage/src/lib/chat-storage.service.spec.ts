// libs/messenger/chat-storage/src/lib/chat-storage.service.spec.ts

import { TestBed } from '@angular/core/testing';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { ChatStorageService } from './chat-storage.service';
import {
  DecryptedMessage,
  ConversationIndexRecord,
} from './chat-storage.models';
import { MessengerDatabase } from './db/messenger.database';
import { ChatMergeStrategy } from './chat-merge.strategy';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';

// --- Fixtures ---
const mockMyUrn = URN.parse('urn:contacts:user:me');
const mockPartnerUrn = URN.parse('urn:contacts:user:bob');

// Correct namespace
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

  beforeEach(async () => {
    await Dexie.delete('messenger');

    TestBed.configureTestingModule({
      providers: [
        ChatStorageService,
        MessengerDatabase,
        MockProvider(Logger),
        // ✅ Mock the new strategy
        MockProvider(ChatMergeStrategy, {
          merge: vi.fn().mockResolvedValue(undefined),
        }),
      ],
    });

    service = TestBed.inject(ChatStorageService);
    db = TestBed.inject(MessengerDatabase);
    mergeStrategy = TestBed.inject(ChatMergeStrategy);
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
      expect(index?.snippet).toBe('Hello Bob');
      expect(index?.unreadCount).toBe(1);
    });

    it('should update existing index with NEWER message', async () => {
      await service.saveMessage(createMsg('m1', 'Old', '2024-01-01T10:00:00Z'));
      await service.saveMessage(createMsg('m2', 'New', '2024-01-01T10:05:00Z'));

      const index = await db.conversations.get(mockPartnerUrn.toString());
      expect(index?.snippet).toBe('New');
      expect(index?.lastActivityTimestamp).toBe('2024-01-01T10:05:00Z');
      expect(index?.unreadCount).toBe(2);
    });
  });

  describe('Smart Merge (Delegation)', () => {
    it('should delegate merge logic to ChatMergeStrategy', async () => {
      const mockIndexData: ConversationIndexRecord[] = [
        {
          conversationUrn: 'urn:test',
          lastActivityTimestamp: '2023-01-01T00:00:00Z',
        } as any,
      ];

      await service.smartMergeConversations(mockIndexData);

      expect(mergeStrategy.merge).toHaveBeenCalledWith(mockIndexData);
    });

    it('should delegate bulkSaveConversations to merge strategy', async () => {
      const mockIndexData: ConversationIndexRecord[] = [];
      await service.bulkSaveConversations(mockIndexData);
      expect(mergeStrategy.merge).toHaveBeenCalledWith(mockIndexData);
    });
  });

  describe('Read Path', () => {
    it('should load summaries from conversation table', async () => {
      await db.conversations.put({
        conversationUrn: 'urn:contacts:user:alice',
        lastActivityTimestamp: '2024-01-02T00:00:00Z',
        snippet: 'Alice Msg',
        previewType: 'text',
        unreadCount: 0,
        genesisTimestamp: null,
        lastModified: '',
      });

      const summaries = await service.loadConversationSummaries();
      expect(summaries.length).toBe(1);
      expect(summaries[0].latestSnippet).toBe('Alice Msg');
    });
  });
});
