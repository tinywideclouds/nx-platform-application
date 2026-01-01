import { TestBed } from '@angular/core/testing';
import { ChatStorageService } from './chat-storage.service';
import { MessengerDatabase } from '../db/messenger.database';
import { ChatDeletionStrategy } from '../strategies/chat-deletion.strategy';
import { MessageMapper } from '../db/mappers/message.mapper';
import { ConversationMapper } from '../db/mappers/conversation.mapper';
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
  const mockMsg: ChatMessage = {
    id: 'm1',
    conversationUrn: convUrn,
    senderId: URN.parse('urn:contacts:user:me'),
    sentTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
    typeId: URN.parse('urn:message:type:text'),
    payloadBytes: new TextEncoder().encode('Hello'),
    status: 'sent',
    tags: [],
    textContent: undefined,
  };

  beforeEach(async () => {
    await Dexie.delete('messenger');

    TestBed.configureTestingModule({
      providers: [
        ChatStorageService,
        MessengerDatabase,
        MessageMapper,
        ConversationMapper,
        // Mock Strategy to verify delegation without running side effects
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

  describe('Message History', () => {
    it('should save message and update conversation index (Side Effect)', async () => {
      await service.saveMessage(mockMsg);

      // Verify Message
      const history = await service.loadHistorySegment(convUrn, 10);
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('m1');
      expect(history[0].conversationUrn.toString()).toBe(
        'urn:messenger:group:lisbon',
      );

      // Verify Conversation Index Update
      const summary = await service.getConversationIndex(convUrn);
      expect(summary).toBeDefined();
      expect(summary?.lastActivityTimestamp).toBe(mockMsg.sentTimestamp);
      expect(summary?.snippet).toBe('Hello');
    });

    it('should delegate deletion to strategy', async () => {
      await service.deleteMessage('m1');
      expect(deletionStrategy.deleteMessage).toHaveBeenCalledWith('m1');
    });
  });

  describe('Cloud Sync Helpers', () => {
    it('should manage cloud enabled setting', async () => {
      expect(await service.isCloudEnabled()).toBe(false);

      await service.setCloudEnabled(true);
      expect(await service.isCloudEnabled()).toBe(true);
    });

    it('should calculate data range', async () => {
      await service.saveMessage(mockMsg);
      await service.saveMessage({
        ...mockMsg,
        id: 'm2',
        sentTimestamp: '2025-01-01T13:00:00Z' as any,
      });

      const range = await service.getDataRange();
      expect(range?.min).toBe('2025-01-01T12:00:00Z');
      expect(range?.max).toBe('2025-01-01T13:00:00Z');
    });
  });

  describe('Maintenance', () => {
    it('should bulk save messages', async () => {
      await service.bulkSaveMessages([mockMsg]);
      const count = await db.messages.count();
      expect(count).toBe(1);
    });

    it('should clear database', async () => {
      await service.saveMessage(mockMsg);
      await service.setCloudEnabled(true);

      await service.clearDatabase();

      expect(await db.messages.count()).toBe(0);
      expect(await db.settings.count()).toBe(0);
    });
  });
});
