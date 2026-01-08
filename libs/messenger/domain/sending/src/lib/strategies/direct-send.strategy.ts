import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import {
  ChatStorageService,
  OutboxStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import {
  MessageDeliveryStatus,
  OutboundMessageRequest,
} from '@nx-platform-application/messenger-types';
import { SendStrategy, SendContext } from '../send-strategy.interface';
import { OutboundResult } from '../send-strategy.interface';

@Injectable({ providedIn: 'root' })
export class DirectSendStrategy implements SendStrategy {
  private logger = inject(Logger);
  private storageService = inject(ChatStorageService);
  private outbox = inject(OutboxStorage);
  private worker = inject(OutboxWorkerService);
  private metadataService = inject(MessageMetadataService);
  private identityResolver = inject(IdentityResolver);

  async send(ctx: SendContext): Promise<OutboundResult> {
    const { optimisticMsg, isEphemeral, recipientUrn, myUrn, myKeys } = ctx;

    // === 0. Optimistic Persistence (Strategy Owned) ===
    if (!isEphemeral) {
      // Direct Strategy: 1 Message -> 1 Record
      await this.storageService.saveMessage(optimisticMsg);
    }

    const outcomePromise = (async (): Promise<MessageDeliveryStatus> => {
      try {
        // === 1. Prepare Wire Format ===
        let wirePayload: Uint8Array;

        if (isEphemeral) {
          wirePayload = optimisticMsg.payloadBytes || new Uint8Array([]);
        } else {
          const networkContextUrn =
            await this.identityResolver.resolveToHandle(myUrn);

          wirePayload = this.metadataService.wrap(
            optimisticMsg.payloadBytes || new Uint8Array([]),
            networkContextUrn,
            optimisticMsg.tags || [],
          );
        }

        // === 2. Transport Execution ===

        if (isEphemeral) {
          this.worker.sendEphemeralBatch(
            [recipientUrn],
            optimisticMsg.typeId,
            wirePayload,
            myUrn,
            myKeys,
          );
          return 'sent';
        }

        const request: OutboundMessageRequest = {
          conversationUrn: recipientUrn,
          typeId: optimisticMsg.typeId,
          payload: wirePayload,
          tags: optimisticMsg.tags || [],
          messageId: optimisticMsg.id,
        };

        await this.outbox.enqueue(request);

        return 'pending';
      } catch (err) {
        this.logger.error('[DirectStrategy] Failed', err);
        if (!isEphemeral) {
          await this.storageService.updateMessageStatus(
            [optimisticMsg.id],
            'failed',
          );
        }
        return 'failed';
      }
    })();

    return { message: optimisticMsg, outcome: outcomePromise };
  }
}
