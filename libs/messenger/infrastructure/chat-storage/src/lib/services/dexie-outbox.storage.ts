import { Injectable, inject } from '@angular/core';
import {
  OutboxStorage,
  OutboundTask,
  DeliveryStatus,
  RecipientProgress,
} from '@nx-platform-application/messenger-domain-outbox';
import {
  MessengerDatabase,
  OutboxMapper,
} from '@nx-platform-application/messenger-infrastructure-db-schema';

@Injectable()
export class DexieOutboxStorage implements OutboxStorage {
  private db = inject(MessengerDatabase);
  private mapper = inject(OutboxMapper);

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
