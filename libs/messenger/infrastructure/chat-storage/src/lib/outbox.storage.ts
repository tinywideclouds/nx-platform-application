import {
  OutboundTask,
  DeliveryStatus,
  RecipientProgress,
} from '@nx-platform-application/messenger-types';
import { URN } from '@nx-platform-application/platform-types';

export interface OutboundMessageRequest {
  conversationUrn: URN;
  typeId: URN;
  payload: Uint8Array;

  // ✅ ADDED: Explicit Recipients support (as discussed for Fan-Out)
  // If undefined, implies 1:1 delivery to conversationUrn
  recipients?: URN[];

  textContent?: string;
  tags?: URN[];

  // Optional: Allow pre-minting ID if the domain needs to track it immediately
  messageId?: string;
}
/**
 * CONTRACT: Outbox Storage
 * Defined in Infrastructure (Layer 1).
 * Consumed by Domain (Layer 2) to decouple logic from Dexie.
 */
export abstract class OutboxStorage {
  /**
   * Schedules a message for delivery.
   * Returns the generated Message ID (Client Record ID).
   */
  abstract enqueue(params: OutboundMessageRequest): Promise<string>;

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
