import { Injectable, inject } from '@angular/core';
import {
  OutboundTask,
  DeliveryStatus,
  RecipientProgress,
} from '@nx-platform-application/messenger-types';
import {
  MessengerDatabase,
  OutboxMapper,
} from '@nx-platform-application/messenger-infrastructure-db-schema';

import { OutboxStorage } from '../outbox.storage';

@Injectable()
export class DexieOutboxStorage implements OutboxStorage {
  private readonly db = inject(MessengerDatabase);
  private readonly mapper = inject(OutboxMapper);

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
    // Dexie doesn't deeply merge arrays automatically in this context
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
