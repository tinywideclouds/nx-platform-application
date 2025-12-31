import { TestBed } from '@angular/core/testing';
import { URN } from '@nx-platform-application/platform-types';
import { OutboxRepository } from './outbox.repository';
import { OutboxMapper } from './db/outbox.mapper';
import { OutboundTask } from './models/outbound-task.model';
import { Dexie } from 'dexie';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

describe('OutboxRepository', () => {
  let repository: OutboxRepository;

  const groupUrn = URN.parse('urn:messenger:group:test-1');
  const typeUrn = URN.parse('urn:message:type:text');

  // Helper to create a domain task
  const createMockTask = (id: string): OutboundTask => ({
    id,
    messageId: `msg-${id}`,
    conversationUrn: groupUrn,
    typeId: typeUrn,
    payload: new Uint8Array([1, 2, 3]),
    tags: [URN.parse('urn:tag:test')],
    status: 'queued',
    createdAt: '2025-01-01T10:00:00Z' as any,
    recipients: [
      { urn: URN.parse('urn:user:alice'), status: 'pending', attempts: 0 },
      { urn: URN.parse('urn:user:bob'), status: 'pending', attempts: 0 },
    ],
  });

  beforeEach(async () => {
    // Reset IndexedDB before each test
    await Dexie.delete('MessengerOutbox');

    TestBed.configureTestingModule({
      providers: [OutboxRepository, OutboxMapper],
    });

    repository = TestBed.inject(OutboxRepository);
  });

  afterEach(async () => {
    // Clean up to prevent database locks between tests
    const db = (repository as any).db;
    if (db.isOpen()) {
      await db.close();
    }
  });

  it('should add a task and retrieve it back as a domain model', async () => {
    const task = createMockTask('task-1');
    await repository.addTask(task);

    const pending = await repository.getPendingTasks();

    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe('task-1');
    // Verify URN re-hydration
    expect(pending[0].conversationUrn).toBeInstanceOf(URN);
    expect(pending[0].conversationUrn.toString()).toBe(groupUrn.toString());
  });

  it('should update overall task status', async () => {
    const task = createMockTask('task-2');
    await repository.addTask(task);

    await repository.updateTaskStatus('task-2', 'completed');

    const pending = await repository.getPendingTasks();
    // 'completed' tasks should not be returned by getPendingTasks
    expect(pending.length).toBe(0);
  });

  it('should update granular recipient progress', async () => {
    const task = createMockTask('task-3');
    await repository.addTask(task);

    // Simulate Alice succeeding, Bob still pending
    const updatedRecipients = [...task.recipients];
    updatedRecipients[0] = { ...updatedRecipients[0], status: 'sent' };

    await repository.updateRecipientProgress('task-3', updatedRecipients);

    const pending = await repository.getPendingTasks();
    const alice = pending[0].recipients.find(
      (r) => r.urn.toString() === 'urn:user:alice',
    );

    expect(alice?.status).toBe('sent');
    expect(pending[0].recipients[1].status).toBe('pending');
  });

  it('should clear the entire outbox', async () => {
    await repository.addTask(createMockTask('task-4'));
    await repository.clearAll();

    const pending = await repository.getPendingTasks();
    expect(pending.length).toBe(0);
  });
});
