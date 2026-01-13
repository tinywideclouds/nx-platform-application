//libs/messenger/infrastructure/chat-storage/src/lib/strategies/chat-merge.strategy.spec.ts
import { TestBed } from '@angular/core/testing';
import { ChatMergeStrategy } from './chat-merge.strategy';
import {
  MessengerDatabase,
  ConversationIndexRecord,
} from '@nx-platform-application/messenger-infrastructure-db-schema';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MockProvider } from 'ng-mocks';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

describe('ChatMergeStrategy', () => {
  let service: ChatMergeStrategy;
  let db: MessengerDatabase;

  beforeEach(async () => {
    await Dexie.delete('messenger');

    TestBed.configureTestingModule({
      providers: [ChatMergeStrategy, MessengerDatabase, MockProvider(Logger)],
    });

    service = TestBed.inject(ChatMergeStrategy);
    db = TestBed.inject(MessengerDatabase);
    await db.open();
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  const createRecord = (
    urn: string,
    time: string,
    snippet: string,
  ): ConversationIndexRecord => ({
    conversationUrn: urn,
    lastActivityTimestamp: time as ISODateTimeString,
    snippet,
    unreadCount: 0,
    previewType: 'text',
    genesisTimestamp: null,
    lastModified: time as ISODateTimeString,
  });

  describe('merge', () => {
    it('should INSERT new conversations from Cloud', async () => {
      const cloudIndex = [
        createRecord('urn:bob', '2023-01-01T12:00:00Z', 'Hello'),
      ];

      await service.merge(cloudIndex);

      const result = await db.conversations.get('urn:bob');
      expect(result).toBeTruthy();
      expect(result?.snippet).toBe('Hello');
    });

    it('should UPDATE local if Cloud is NEWER', async () => {
      await db.conversations.put(
        createRecord('urn:bob', '2023-01-01T10:00:00Z', 'Old Local'),
      );

      const cloudIndex = [
        createRecord('urn:bob', '2023-01-01T12:00:00Z', 'New Cloud'),
      ];

      await service.merge(cloudIndex);

      const result = await db.conversations.get('urn:bob');
      expect(result?.snippet).toBe('New Cloud');
      expect(result?.lastActivityTimestamp).toBe('2023-01-01T12:00:00Z');
    });

    it('should IGNORE cloud record if Local is NEWER (Offline edits)', async () => {
      await db.conversations.put(
        createRecord('urn:bob', '2023-01-01T12:00:00Z', 'New Local'),
      );

      const cloudIndex = [
        createRecord('urn:bob', '2023-01-01T10:00:00Z', 'Old Cloud'),
      ];

      await service.merge(cloudIndex);

      const result = await db.conversations.get('urn:bob');
      expect(result?.snippet).toBe('New Local');
      expect(result?.lastActivityTimestamp).toBe('2023-01-01T12:00:00Z');
    });
  });
});
