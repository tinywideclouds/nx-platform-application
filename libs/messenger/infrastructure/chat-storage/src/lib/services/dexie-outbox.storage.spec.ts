import { TestBed } from '@angular/core/testing';
import { DexieOutboxStorage } from './dexie-outbox.storage';
import {
  MessengerDatabase,
  OutboxMapper,
  OutboxRecord,
} from '@nx-platform-application/messenger-infrastructure-db-schema';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { OutboundTask } from '@nx-platform-application/messenger-types';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Dexie } from 'dexie';
import 'fake-indexeddb/auto';

// ✅ NEW IMPORT: The Request Contract
import { OutboundMessageRequest } from '../outbox.storage';

describe('DexieOutboxStorage', () => {
  let storage: DexieOutboxStorage;
  let db: MessengerDatabase;

  const mockRecord: OutboxRecord = {
    id: 't1',
    messageId: 'm1',
    conversationUrn: 'urn:messenger:group:g1',
    typeId: 'urn:message:type:text',
    payload: new Uint8Array([1]),
    tags: [],
    status: 'queued',
    createdAt: '2025-01-01',
    recipients: [],
  };

  // Legacy task for addTask tests
  const mockTask: OutboundTask = {
    id: 't1',
    messageId: 'm1',
    conversationUrn: URN.parse('urn:messenger:group:g1'),
    typeId: URN.parse('urn:message:type:text'),
    payload: new Uint8Array([1]),
    tags: [],
    status: 'queued',
    createdAt: '2025-01-01' as ISODateTimeString,
    recipients: [],
  };

  beforeEach(async () => {
    await Dexie.delete('messenger');

    TestBed.configureTestingModule({
      providers: [DexieOutboxStorage, MessengerDatabase, OutboxMapper],
    });

    storage = TestBed.inject(DexieOutboxStorage);
    db = TestBed.inject(MessengerDatabase);
    await db.open();
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  // ✅ NEW: Testing the "Writer" Logic
  describe('enqueue', () => {
    it('should create a 1:1 task when recipients are omitted', async () => {
      const request: OutboundMessageRequest = {
        conversationUrn: URN.parse('urn:contacts:user:bob'),
        typeId: URN.parse('urn:message:type:text'),
        payload: new Uint8Array([1, 2, 3]),
        // recipients undefined
      };

      const messageId = await storage.enqueue(request);

      // Verify ID returned
      expect(messageId).toBeTruthy();

      // Verify Persistence
      const tasks = await db.outbox.toArray();
      expect(tasks).toHaveLength(1);
      const record = tasks[0];

      expect(record.conversationUrn).toBe('urn:contacts:user:bob');
      expect(record.status).toBe('queued');
      // Implicit 1:1 Recipient
      expect(record.recipients).toHaveLength(1);
      expect(record.recipients[0].urn).toBe('urn:contacts:user:bob');
      expect(record.recipients[0].status).toBe('pending');
    });

    it('should create a Fan-Out task when recipients are explicit', async () => {
      const groupUrn = URN.parse('urn:messenger:group:party');
      const alice = URN.parse('urn:contacts:user:alice');
      const bob = URN.parse('urn:contacts:user:bob');

      const request: OutboundMessageRequest = {
        conversationUrn: groupUrn,
        typeId: URN.parse('urn:message:type:text'),
        payload: new Uint8Array([1]),
        recipients: [alice, bob], // ✅ Explicit Fan-Out
      };

      await storage.enqueue(request);

      const tasks = await db.outbox.toArray();
      const record = tasks[0];

      // Context is Group
      expect(record.conversationUrn).toBe(groupUrn.toString());

      // Targets are Members
      expect(record.recipients).toHaveLength(2);
      const recipientUrns = record.recipients.map((r) => r.urn).sort();
      expect(recipientUrns).toEqual([alice.toString(), bob.toString()].sort());
    });
  });

  describe('legacy (addTask)', () => {
    it('should add task to DB via mapper', async () => {
      await storage.addTask(mockTask);
      const record = await db.outbox.get('t1');
      expect(record).toBeDefined();
      expect(record?.conversationUrn).toBe('urn:messenger:group:g1');
    });
  });

  describe('status updates', () => {
    it('should retrieve pending tasks', async () => {
      await db.outbox.bulkPut([
        { ...mockRecord, id: 't1', status: 'queued' },
        { ...mockRecord, id: 't2', status: 'processing' },
        { ...mockRecord, id: 't3', status: 'completed' },
      ]);

      const tasks = await storage.getPendingTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.id).sort()).toEqual(['t1', 't2']);
    });

    it('should update recipient progress', async () => {
      await storage.addTask(mockTask); // Seed with empty recipients

      const updatePayload = [
        {
          urn: URN.parse('urn:contacts:user:alice'),
          status: 'sent' as const,
          attempts: 1,
        },
      ];

      await storage.updateRecipientProgress('t1', updatePayload);

      const record = await db.outbox.get('t1');
      expect(record?.recipients[0].urn).toBe('urn:contacts:user:alice');
      expect(record?.recipients[0].status).toBe('sent');
    });
  });
});
