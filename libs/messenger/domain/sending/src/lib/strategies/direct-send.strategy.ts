import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import {
  ChatStorageService,
  OutboxStorage,
  OutboundMessageRequest,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { MessageDeliveryStatus } from '@nx-platform-application/messenger-types';
import { SendStrategy, SendContext } from './send-strategy.interface';
import { OutboundResult } from '../outbound.service';

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

    const outcomePromise = (async (): Promise<MessageDeliveryStatus> => {
      try {
        // === 1. Prepare Wire Format (Formatter Responsibility) ===
        let wirePayload: Uint8Array;

        if (isEphemeral) {
          // SIGNALS (Typing, Receipts):
          // Pass opaque RAW bytes. Do not wrap. Do not resolve context.
          // The parser expects a flat structure.
          wirePayload = optimisticMsg.payloadBytes || new Uint8Array([]);
        } else {
          // CONTENT (Text, Rich):
          // 1. Resolve Context: In 1:1, the context is the Sender.
          //    We must map Local URN ("me") -> Network Handle.
          const networkContextUrn =
            await this.identityResolver.resolveToHandle(myUrn);

          // 2. Wrap: The envelope ensures the recipient knows the context.
          wirePayload = this.metadataService.wrap(
            optimisticMsg.payloadBytes || new Uint8Array([]),
            networkContextUrn,
            optimisticMsg.tags || [],
          );
        }

        // === 2. Transport Execution ===

        if (isEphemeral) {
          // FAST LANE: Hand off to Courier
          this.worker.sendEphemeralBatch(
            [recipientUrn],
            optimisticMsg.typeId,
            wirePayload, // Raw
            myUrn,
            myKeys,
          );
          return 'sent';
        }

        // SLOW LANE: Enqueue to DB
        const request: OutboundMessageRequest = {
          conversationUrn: recipientUrn,
          typeId: optimisticMsg.typeId,
          payload: wirePayload, // Wrapped & Resolved
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
