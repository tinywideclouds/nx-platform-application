import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  TransportMessage,
  OutboundTask,
} from '@nx-platform-application/messenger-types';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatSendService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { OutboxStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { Temporal } from '@js-temporal/polyfill';

@Injectable({ providedIn: 'root' })
export class OutboxWorkerService {
  private readonly repo = inject(OutboxStorage);
  private readonly keyCache = inject(KeyCacheService);
  private readonly crypto = inject(MessengerCryptoService);
  private readonly sendService = inject(ChatSendService);
  private readonly logger = inject(Logger);
  private readonly identityResolver = inject(IdentityResolver);

  private isProcessing = false;
  private pendingTrigger = false;

  async processQueue(senderUrn: URN, myKeys: PrivateKeys): Promise<void> {
    if (this.isProcessing) {
      this.pendingTrigger = true;
      return;
    }

    this.isProcessing = true;
    console.info('starting outbox processing');
    try {
      do {
        // if (this.pendingTrigger) {
        //   console.log('draining pending trigger');
        // }
        this.pendingTrigger = false; // Reset flag at start of loop
        const pendingTasks = await this.repo.getPendingTasks();
        // console.log(`found ${pendingTasks.length} pending tasks`);
        for (const task of pendingTasks) {
          await this.processTask(task, senderUrn, myKeys);
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
    senderUrn: URN,
    myKeys: PrivateKeys,
  ): Promise<void> {
    const promises = recipients.map(async (recipientUrn) => {
      try {
        await this.coreDelivery(
          recipientUrn,
          payloadBytes,
          typeId,
          senderUrn,
          myKeys,
          undefined,
          true,
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

  private async processTask(
    task: OutboundTask,
    senderUrn: URN,
    myKeys: PrivateKeys,
  ): Promise<void> {
    await this.repo.updateTaskStatus(task.id, 'processing');

    for (const recipient of task.recipients) {
      if (recipient.status === 'sent') continue;

      try {
        await this.coreDelivery(
          recipient.urn,
          task.payload,
          task.typeId,
          senderUrn,
          myKeys,
          // ✅ Pass the ID we want the client to track.
          // If parentMessageId exists (Broadcast), use it.
          // Otherwise use the task's messageId.
          task.parentMessageId || task.messageId,
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
      await this.repo.updateRecipientProgress(task.id, task.recipients);
    }

    const allDone = task.recipients.every((r) => r.status === 'sent');
    await this.repo.updateTaskStatus(task.id, allDone ? 'completed' : 'failed');
  }

  private async coreDelivery(
    recipientContactUrn: URN,
    finalPayloadBytes: Uint8Array,
    typeId: URN,
    senderContactUrn: URN,
    myKeys: PrivateKeys,
    messageId?: string,
    isEphemeral = false,
  ): Promise<void> {
    // 1. Resolve Routing
    const targetRoutingUrn =
      await this.identityResolver.resolveToHandle(recipientContactUrn);
    const payloadSenderUrn =
      await this.identityResolver.resolveToHandle(senderContactUrn);

    // 2. Fetch Keys
    const recipientKeys = await this.keyCache.getPublicKey(targetRoutingUrn);

    // 3. Create Transport Envelope
    const transportPayload: TransportMessage = {
      senderId: payloadSenderUrn,
      sentTimestamp: Temporal.Now.instant().toString() as ISODateTimeString,
      typeId: typeId,
      payloadBytes: finalPayloadBytes,

      // ✅ This is what the Recipient sees (and sends back in receipts)
      clientRecordId: messageId,
    };

    // 4. Encrypt & Sign
    const envelope = await this.crypto.encryptAndSign(
      transportPayload,
      targetRoutingUrn,
      myKeys,
      recipientKeys,
    );

    if (isEphemeral) {
      envelope.isEphemeral = true;
    }

    // 5. Send
    await firstValueFrom(this.sendService.sendMessage(envelope));
  }

  async clearAllTasks(): Promise<void> {
    await this.repo.clearAll();
  }
}
