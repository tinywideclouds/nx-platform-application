import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  ChatStorageService,
  OutboxStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { OutboundMessageRequest } from '@nx-platform-application/messenger-types';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import {
  SendStrategy,
  SendContext,
  OutboundResult,
} from '../send-strategy.interface';

@Injectable({ providedIn: 'root' })
export class LocalBroadcastStrategy implements SendStrategy {
  private logger = inject(Logger);
  private storageService = inject(ChatStorageService);
  private outboxStorage = inject(OutboxStorage);
  private metadataService = inject(MessageMetadataService);
  private identityResolver = inject(IdentityResolver);
  private worker = inject(OutboxWorkerService);

  // ✅ REMOVED: ContactsQueryApi (It was making this strategy too smart)

  async send(ctx: SendContext): Promise<OutboundResult> {
    const {
      optimisticMsg,
      shouldPersist,
      isEphemeral,
      myUrn,
      myKeys,
      recipients, // ✅ Must be provided by the Facade
    } = ctx;

    try {
      if (!recipients || recipients.length === 0) {
        throw new Error(
          '[LocalBroadcastStrategy] No recipients provided in context',
        );
      }

      // 1. Persist (Aggregation)
      // We save the single message to the "Context" conversation
      if (shouldPersist) {
        await this.storageService.saveMessage(optimisticMsg);
      }

      // 2. Prepare Wire Payload (1:1 Context)
      const networkContextUrn =
        await this.identityResolver.resolveToHandle(myUrn);
      const wirePayload = this.metadataService.wrap(
        optimisticMsg.payloadBytes || new Uint8Array([]),
        networkContextUrn,
        optimisticMsg.tags || [],
      );

      // 3. Execution (Fan-Out)
      if (isEphemeral) {
        this.worker.sendEphemeralBatch(
          recipients,
          optimisticMsg.typeId,
          wirePayload,
          myUrn,
          myKeys,
        );
        return { message: optimisticMsg, outcome: Promise.resolve('sent') };
      }

      // 4. Reliable Fan-Out (Queueing)
      const loopPromises = recipients.map(async (urn) => {
        const request: OutboundMessageRequest = {
          conversationUrn: urn, // Target the individual
          typeId: optimisticMsg.typeId,
          payload: wirePayload,
          tags: optimisticMsg.tags || [],
          messageId: optimisticMsg.id, // Link back for receipts
        };
        await this.outboxStorage.enqueue(request);
      });

      await Promise.all(loopPromises);

      return { message: optimisticMsg, outcome: Promise.resolve('pending') };
    } catch (err) {
      this.logger.error('[LocalBroadcastStrategy] Failed', err);
      if (shouldPersist) {
        await this.storageService.updateMessageStatus(
          [optimisticMsg.id],
          'failed',
        );
      }
      return {
        message: { ...optimisticMsg, status: 'failed' },
        outcome: Promise.resolve('failed'),
      };
    }
  }
}
