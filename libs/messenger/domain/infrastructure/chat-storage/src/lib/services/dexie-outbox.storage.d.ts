import { OutboundTask, DeliveryStatus, RecipientProgress, OutboundMessageRequest } from '@nx-platform-application/messenger-types';
import { OutboxStorage } from '../outbox.storage';
import * as i0 from "@angular/core";
export declare class DexieOutboxStorage implements OutboxStorage {
    private readonly db;
    private readonly mapper;
    /**
     * WRITER: Converts a Domain Request into a Persisted Task.
     * Handles "Fan-Out" logic for multiple recipients.
     */
    enqueue(request: OutboundMessageRequest): Promise<string>;
    addTask(task: OutboundTask): Promise<void>;
    getPendingTasks(): Promise<OutboundTask[]>;
    updateTaskStatus(taskId: string, status: DeliveryStatus): Promise<void>;
    updateRecipientProgress(taskId: string, recipients: RecipientProgress[]): Promise<void>;
    deleteTask(taskId: string): Promise<void>;
    clearAll(): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<DexieOutboxStorage, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<DexieOutboxStorage>;
}
