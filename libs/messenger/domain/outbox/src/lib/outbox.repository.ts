import {
  OutboundTask,
  DeliveryStatus,
  RecipientProgress,
} from './models/outbound-task.model';

/**
 * CONTRACT: The Domain needs storage, but Infrastructure decides HOW.
 * This decouples the Domain from Dexie/IndexedDB.
 */
export abstract class OutboxRepository {
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
