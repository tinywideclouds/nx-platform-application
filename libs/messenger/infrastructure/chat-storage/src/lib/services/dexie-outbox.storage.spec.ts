//libs/messenger/infrastructure/chat-storage/src/lib/services/dexie-outbox.storage.spec.ts
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
import { OutboundTask } from '@nx-platform-application/messenger-domain-outbox';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Dexie } from 'dexie';
import 'fake-indexeddb/auto';

describe('DexieOutboxStorage', () => {
  let storage: DexieOutboxStorage;
  let db: MessengerDatabase;

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

  it('should add task to DB via mapper', async () => {
    await storage.addTask(mockTask);

    const record = await db.outbox.get('t1');
    expect(record).toBeDefined();
    expect(record?.conversationUrn).toBe('urn:messenger:group:g1');
  });

  it('should retrieve pending tasks', async () => {
    await db.outbox.bulkPut([
      { ...mockRecord, id: 't1', status: 'queued' },
      { ...mockRecord, id: 't2', status: 'processing' },
      { ...mockRecord, id: 't3', status: 'completed' },
    ]);

    const tasks = await storage.getPendingTasks();
    expect(tasks).toHaveLength(2);

    const ids = tasks.map((t) => t.id).sort();
    expect(ids).toEqual(['t1', 't2']);
  });

  it('should update task status', async () => {
    await db.outbox.put({ ...mockRecord, id: 't1', status: 'queued' });

    await storage.updateTaskStatus('t1', 'failed');

    const updated = await db.outbox.get('t1');
    expect(updated?.status).toBe('failed');
  });

  it('should update recipient progress', async () => {
    await storage.addTask(mockTask);

    const recipients = [
      {
        urn: URN.parse('urn:contacts:user:alice'),
        status: 'sent' as const,
        attempts: 1,
      },
    ];

    await storage.updateRecipientProgress('t1', recipients);

    const record = await db.outbox.get('t1');
    expect(record?.recipients[0].urn).toBe('urn:contacts:user:alice');
    expect(record?.recipients[0].status).toBe('sent');
  });

  it('should delete a task', async () => {
    await db.outbox.put(mockRecord);
    await storage.deleteTask('t1');
    const result = await db.outbox.get('t1');
    expect(result).toBeUndefined();
  });

  it('should clear all tasks', async () => {
    await db.outbox.put(mockRecord);
    await storage.clearAll();
    const count = await db.outbox.count();
    expect(count).toBe(0);
  });
});
