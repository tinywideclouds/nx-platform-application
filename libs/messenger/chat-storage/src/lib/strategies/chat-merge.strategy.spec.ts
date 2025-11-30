// libs/messenger/chat-storage/src/lib/chat-merge.strategy.spec.ts

import { TestBed } from '@angular/core/testing';
import { ChatMergeStrategy } from './chat-merge.strategy';
import { MessengerDatabase } from '../db/messenger.database';
import { ConversationIndexRecord } from '../db/chat-storage.models';
import { Logger } from '@nx-platform-application/console-logger';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';

describe('ChatMergeStrategy', () => {
  let service: ChatMergeStrategy;
  let db: MessengerDatabase;

  beforeEach(async () => {
    // Clean slate for IndexedDB
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
    snippet: string
  ): ConversationIndexRecord => ({
    conversationUrn: urn,
    lastActivityTimestamp: time,
    snippet,
    unreadCount: 0,
    previewType: 'text',
    genesisTimestamp: null,
    lastModified: time,
  });

  describe('merge', () => {
    it('should INSERT new conversations from Cloud', async () => {
      // 1. Setup: Local DB is empty
      const cloudIndex = [
        createRecord('urn:bob', '2023-01-01T12:00:00Z', 'Hello'),
      ];

      // 2. Action
      await service.merge(cloudIndex);

      // 3. Assert
      const result = await db.conversations.get('urn:bob');
      expect(result).toBeTruthy();
      expect(result?.snippet).toBe('Hello');
    });

    it('should UPDATE local if Cloud is NEWER', async () => {
      // 1. Setup: Local has old data
      await db.conversations.put(
        createRecord('urn:bob', '2023-01-01T10:00:00Z', 'Old Local')
      );

      // 2. Setup: Cloud has newer data (2 hours later)
      const cloudIndex = [
        createRecord('urn:bob', '2023-01-01T12:00:00Z', 'New Cloud'),
      ];

      // 3. Action
      await service.merge(cloudIndex);

      // 4. Assert: Should accept Cloud
      const result = await db.conversations.get('urn:bob');
      expect(result?.snippet).toBe('New Cloud');
      expect(result?.lastActivityTimestamp).toBe('2023-01-01T12:00:00Z');
    });

    it('should IGNORE cloud if Local is NEWER (Offline Changes)', async () => {
      // 1. Setup: Local has very recent data (user just typed)
      await db.conversations.put(
        createRecord('urn:bob', '2023-01-01T14:00:00Z', 'My Offline Reply')
      );

      // 2. Setup: Cloud has data from before I went offline
      const cloudIndex = [
        createRecord('urn:bob', '2023-01-01T12:00:00Z', 'Stale Cloud State'),
      ];

      // 3. Action
      await service.merge(cloudIndex);

      // 4. Assert: Should PRESERVE Local
      const result = await db.conversations.get('urn:bob');
      expect(result?.snippet).toBe('My Offline Reply');
      expect(result?.lastActivityTimestamp).toBe('2023-01-01T14:00:00Z');
    });

    it('should handle mixed batch (Insert, Update, Ignore)', async () => {
      // Local State
      await db.conversations.bulkPut([
        createRecord('urn:alice', '2023-01-01T10:00:00Z', 'Alice Old'), // Will update
        createRecord('urn:dave', '2023-01-01T20:00:00Z', 'Dave Recent'), // Will keep
      ]);

      const cloudIndex = [
        createRecord('urn:alice', '2023-01-01T12:00:00Z', 'Alice New'), // Newer
        createRecord('urn:dave', '2023-01-01T10:00:00Z', 'Dave Stale'), // Older
        createRecord('urn:charlie', '2023-01-01T12:00:00Z', 'Charlie New'), // New
      ];

      await service.merge(cloudIndex);

      const alice = await db.conversations.get('urn:alice');
      const dave = await db.conversations.get('urn:dave');
      const charlie = await db.conversations.get('urn:charlie');

      expect(alice?.snippet).toBe('Alice New'); // Updated
      expect(dave?.snippet).toBe('Dave Recent'); // Ignored Cloud
      expect(charlie?.snippet).toBe('Charlie New'); // Inserted
    });
  });
});
