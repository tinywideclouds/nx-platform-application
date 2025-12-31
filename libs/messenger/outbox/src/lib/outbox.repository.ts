import { Injectable, inject } from '@angular/core';
import { OutboxDatabase } from './db/outbox.database';
import { OutboxMapper } from './db/outbox.mapper';
import { OutboundTask, DeliveryStatus } from './models/outbound-task.model';

@Injectable({ providedIn: 'root' })
export class OutboxRepository {
  private readonly db = new OutboxDatabase();
  private readonly mapper = inject(OutboxMapper);

  /**
   * Persists a new outbound task to the database.
   * Converts the Domain model to a Storage record before saving.
   */
  async addTask(task: OutboundTask): Promise<void> {
    const record = this.mapper.toRecord(task);
    await this.db.outbox.add(record);
  }

  /**
   * Retrieves all tasks currently in a 'queued' or 'processing' state.
   * Useful for the Worker to resume work on app startup.
   */
  async getPendingTasks(): Promise<OutboundTask[]> {
    const records = await this.db.outbox
      .where('status')
      .anyOf(['queued', 'processing'])
      .toArray();

    return records.map((r) => this.mapper.toDomain(r));
  }

  /**
   * Updates the overall status of a task (e.g., from 'processing' to 'completed').
   */
  async updateTaskStatus(
    taskId: string,
    status: DeliveryStatus,
  ): Promise<void> {
    await this.db.outbox.update(taskId, { status });
  }

  /**
   * Updates the granular recipient progress array.
   * This is critical for fan-out so we don't re-send to recipients who already received it.
   */
  async updateRecipientProgress(
    taskId: string,
    recipients: OutboundTask['recipients'],
  ): Promise<void> {
    // Map domain recipients back to storage strings for the update
    const serializedRecipients = recipients.map((r) => ({
      ...r,
      urn: r.urn.toString(),
    }));

    await this.db.outbox.update(taskId, { recipients: serializedRecipients });
  }

  /**
   * Deletes a task once it is finished (optional, depending on your retention policy).
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.db.outbox.delete(taskId);
  }

  /**
   * Clears the entire outbox. Used for the "Nuclear" device wipe.
   */
  async clearAll(): Promise<void> {
    await this.db.outbox.clear();
  }
}
