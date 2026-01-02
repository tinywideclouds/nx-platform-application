import {
  OutboundTask,
  DeliveryStatus,
  RecipientProgress,
} from '@nx-platform-application/messenger-types';

/**
 * CONTRACT: Outbox Storage
 * Defined in Infrastructure (Layer 1).
 * Consumed by Domain (Layer 2) to decouple logic from Dexie.
 */
export abstract class OutboxStorage {
  abstract addTask(task: OutboundTask): Promise<void>;

  abstract getPendingTasks(): Promise<OutboundTask[]>;

  abstract updateTaskStatus(
    taskId: string,
    status: DeliveryStatus,
  ): Promise<void>;

  abstract updateRecipientProgress(
    taskId: string,
    recipients: RecipientProgress[],
  ): Promise<void>;

  abstract deleteTask(taskId: string): Promise<void>;

  abstract clearAll(): Promise<void>;
}
