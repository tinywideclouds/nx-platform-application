import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ISODateTimeString,
  Priority,
  URN,
} from '@nx-platform-application/platform-types';
import {
  TransportMessage,
  OutboundTask,
} from '@nx-platform-application/messenger-types';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { MessageSecurityService } from '@nx-platform-application/messenger-infrastructure-message-security';
import { ChatSendService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { OutboxStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { Temporal } from '@js-temporal/polyfill';

import { SessionService } from '@nx-platform-application/messenger-domain-session';

@Injectable({ providedIn: 'root' })
export class OutboxWorkerService {
  private readonly outbox = inject(OutboxStorage);
  private readonly keyCache = inject(KeyCacheService);
  private readonly crypto = inject(MessageSecurityService);
  private readonly sendService = inject(ChatSendService);
  private readonly logger = inject(Logger);

  private readonly sessionService = inject(SessionService);

  private isProcessing = false;
  private pendingTrigger = false;

  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      this.pendingTrigger = true;
      return;
    }

    this.isProcessing = true;
    try {
      do {
        // if (this.pendingTrigger) {
        //   console.log('draining pending trigger');
        // }
        this.pendingTrigger = false; // Reset flag at start of loop
        const pendingTasks = await this.outbox.getPendingTasks();
        console.log(`OUTBOX WORKER found ${pendingTasks.length} pending tasks`);
        for (const task of pendingTasks) {
          await this.processTask(task);
        }
      } while (this.pendingTrigger);
    } finally {
      this.isProcessing = false;
      console.info('outbox processing complete');
    }
  }

  async sendEphemeralBatch(
    recipients: URN[],
    typeId: URN,
    payloadBytes: Uint8Array,
  ): Promise<void> {
    const promises = recipients.map(async (recipientUrn) => {
      try {
        await this.coreDelivery(
          recipientUrn,
          payloadBytes,
          typeId,
          undefined,
          true,
          Priority.Low,
        );
      } catch (e) {
        this.logger.warn(
          `[OutboxWorker] Ephemeral send failed for ${recipientUrn.toString()}`,
        );
      }
    });

    await Promise.allSettled(promises);
  }

  // --- Internal Helpers ---

  private async processTask(task: OutboundTask): Promise<void> {
    await this.outbox.updateTaskStatus(task.id, 'processing');

    for (const recipient of task.recipients) {
      if (recipient.status === 'sent') continue;

      try {
        await this.coreDelivery(
          recipient.urn,
          task.payload,
          task.typeId,
          // ✅ Pass the ID we want the client to track.
          // If parentMessageId exists (Broadcast), use it.
          // Otherwise use the task's messageId.
          task.parentMessageId || task.messageId,
          false,
          task.priority,
        );

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
      await this.outbox.updateRecipientProgress(task.id, task.recipients);
    }

    const allDone = task.recipients.every((r) => r.status === 'sent');
    await this.outbox.updateTaskStatus(
      task.id,
      allDone ? 'completed' : 'failed',
    );
  }

  private async coreDelivery(
    targetRoutingUrn: URN,
    finalPayloadBytes: Uint8Array,
    typeId: URN,
    messageId?: string,
    isEphemeral = false,
    priority: Priority = 1,
  ): Promise<void> {
    // 2. Fetch Keys
    const recipientKeys = await this.keyCache.getPublicKey(targetRoutingUrn);

    // Always use myNetworkUrn for sending

    const session = this.sessionService.snapshot;

    const now = Temporal.Now.instant().toString();

    console.log(
      'SENDING FROM ',
      session.networkUrn,
      isEphemeral,
      priority,
      now,
    );

    // 3. Create Transport Envelope
    const transportPayload: TransportMessage = {
      senderId: session.networkUrn,
      sentTimestamp: now as ISODateTimeString,
      typeId: typeId,
      payloadBytes: finalPayloadBytes,

      // ✅ This is what the Recipient sees (and sends back in receipts)
      clientRecordId: messageId,
    };

    // 4. Encrypt & Sign
    const envelope = await this.crypto.encryptAndSign(
      transportPayload,
      targetRoutingUrn,
      session.keys,
      recipientKeys,
    );

    if (isEphemeral) {
      envelope.isEphemeral = true;
      envelope.priority = Priority.Low;
    } else {
      envelope.priority = priority;
    }

    // 5. Send
    await firstValueFrom(this.sendService.sendMessage(envelope));
  }

  async clearAllTasks(): Promise<void> {
    await this.outbox.clearAll();
  }
}
