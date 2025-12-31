import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { TransportMessage } from '@nx-platform-application/messenger-types';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-bridge';
import { ChatSendService } from '@nx-platform-application/chat-access';
import { Logger } from '@nx-platform-application/console-logger';
import { MessageMetadataService } from '@nx-platform-application/message-content'; // ✅ Centralized service

import { OutboxRepository } from './outbox.repository';
import { OutboundTask, RecipientProgress } from './models/outbound-task.model';

@Injectable({ providedIn: 'root' })
export class OutboxWorkerService {
  private readonly repo = inject(OutboxRepository);
  private readonly keyCache = inject(KeyCacheService);
  private readonly crypto = inject(MessengerCryptoService);
  private readonly sendService = inject(ChatSendService);
  private readonly logger = inject(Logger);
  private readonly metadataService = inject(MessageMetadataService); // ✅ Inject central logic

  private isProcessing = false;

  async processQueue(senderUrn: URN, myKeys: PrivateKeys): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingTasks = await this.repo.getPendingTasks();
      for (const task of pendingTasks) {
        await this.processTask(task, senderUrn, myKeys);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async clearAllTasks(): Promise<void> {
    await this.repo.clearAll();
  }

  private async processTask(
    task: OutboundTask,
    senderUrn: URN,
    myKeys: PrivateKeys,
  ): Promise<void> {
    await this.repo.updateTaskStatus(task.id, 'processing');

    for (const recipient of task.recipients) {
      if (recipient.status === 'sent') continue;

      try {
        await this.deliverToRecipient(task, recipient, senderUrn, myKeys);
        recipient.status = 'sent';
      } catch (error: any) {
        recipient.status = 'failed';
        recipient.error = error.message;
        recipient.attempts++;
        this.logger.error(
          `[OutboxWorker] Delivery failed for ${recipient.urn.toString()}`,
          error,
        );
      }

      await this.repo.updateRecipientProgress(task.id, task.recipients);
    }

    const allDone = task.recipients.every((r) => r.status === 'sent');
    await this.repo.updateTaskStatus(task.id, allDone ? 'completed' : 'failed');
  }

  private async deliverToRecipient(
    task: OutboundTask,
    recipient: RecipientProgress,
    senderUrn: URN,
    myKeys: PrivateKeys,
  ): Promise<void> {
    const recipientKeys = await this.keyCache.getPublicKey(recipient.urn);

    // ✅ FIX: Use centralized wrapping logic for ConversationID and Tags
    const innerTypedPayload = this.metadataService.wrap(
      task.payload,
      task.conversationUrn,
      task.tags || [],
    );

    const payload: TransportMessage = {
      senderId: senderUrn,
      sentTimestamp: task.createdAt,
      typeId: task.typeId,
      payloadBytes: innerTypedPayload,
      clientRecordId: task.messageId,
    };

    const envelope = await this.crypto.encryptAndSign(
      payload as any,
      recipient.urn,
      myKeys,
      recipientKeys,
    );

    await firstValueFrom(this.sendService.sendMessage(envelope));
  }
}
