import { Injectable, inject } from '@angular/core';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  OutboundTask,
  DeliveryStatus,
  RecipientProgress,
  OutboundMessageRequest,
} from '@nx-platform-application/messenger-types';
import {
  MessengerDatabase,
  OutboxMapper,
} from '@nx-platform-application/messenger-infrastructure-db-schema';
import { Temporal } from '@js-temporal/polyfill';

// ✅ UPDATED: Import the new Request type
import { OutboxStorage } from '../outbox.storage';

@Injectable()
export class DexieOutboxStorage implements OutboxStorage {
  private readonly db = inject(MessengerDatabase);
  private readonly mapper = inject(OutboxMapper);

  /**
   * WRITER: Converts a Domain Request into a Persisted Task.
   * Handles "Fan-Out" logic for multiple recipients.
   */
  async enqueue(request: OutboundMessageRequest): Promise<string> {
    const now = Temporal.Now.instant().toString() as ISODateTimeString;
    // Use provided ID or mint a new one
    const messageId = request.messageId || crypto.randomUUID();
    const taskId = crypto.randomUUID();

    // 1. Fan-Out Logic
    // If explicit recipients are provided (Group Chat), use them.
    // Otherwise, default to the conversation URN (1:1 Chat).
    const targetUrns =
      request.recipients && request.recipients.length > 0
        ? request.recipients
        : [request.conversationUrn];

    // 2. Initialize Progress Tracking (All start as 'pending')
    const recipients: RecipientProgress[] = targetUrns.map((urn: URN) => ({
      urn,
      status: 'pending',
      attempts: 0,
    }));

    // 3. Create Domain State Object
    const task: OutboundTask = {
      id: taskId,
      messageId,
      conversationUrn: request.conversationUrn,
      typeId: request.typeId,
      payload: request.payload,
      tags: request.tags || [],
      recipients,
      status: 'queued',
      createdAt: now,
    };

    // 4. Persist (Map Domain -> DB Record)
    //
    const record = this.mapper.toRecord(task);
    await this.db.outbox.add(record);

    return messageId;
  }

  async addTask(task: OutboundTask): Promise<void> {
    const record = this.mapper.toRecord(task);
    await this.db.outbox.add(record);
  }

  async getPendingTasks(): Promise<OutboundTask[]> {
    const records = await this.db.outbox
      .where('status')
      .anyOf(['queued', 'processing'])
      .toArray();

    return records.map((r) => this.mapper.toDomain(r));
  }

  async updateTaskStatus(
    taskId: string,
    status: DeliveryStatus,
  ): Promise<void> {
    await this.db.outbox.update(taskId, { status });
  }

  async updateRecipientProgress(
    taskId: string,
    recipients: RecipientProgress[],
  ): Promise<void> {
    // We must manually serialize the recipients array to update it partially
    // - URNs must be strings in DB
    const serializedRecipients = recipients.map((r) => ({
      ...r,
      urn: r.urn.toString(),
    }));

    await this.db.outbox.update(taskId, { recipients: serializedRecipients });
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.db.outbox.delete(taskId);
  }

  async clearAll(): Promise<void> {
    await this.db.outbox.clear();
  }
}
