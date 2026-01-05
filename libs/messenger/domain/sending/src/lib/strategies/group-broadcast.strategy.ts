import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import {
  ChatStorageService,
  OutboxStorage,
  OutboundMessageRequest,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { MessageDeliveryStatus } from '@nx-platform-application/messenger-types';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { SendStrategy, SendContext } from './send-strategy.interface';
import { OutboundResult } from '../outbound.service';

@Injectable({ providedIn: 'root' })
export class LocalBroadcastStrategy implements SendStrategy {
  private logger = inject(Logger);
  private storageService = inject(ChatStorageService);
  private contactsApi = inject(ContactsQueryApi);
  private metadataService = inject(MessageMetadataService);
  private outboxStorage = inject(OutboxStorage);
  private worker = inject(OutboxWorkerService);
  private identityResolver = inject(IdentityResolver);

  async send(ctx: SendContext): Promise<OutboundResult> {
    const { myUrn, recipientUrn, optimisticMsg, isEphemeral, myKeys } = ctx;

    const outcomePromise = (async (): Promise<MessageDeliveryStatus> => {
      try {
        const participants =
          await this.contactsApi.getGroupParticipants(recipientUrn);

        // === 1. Prepare Wire Format (Formatter Responsibility) ===

        let wirePayload: Uint8Array;

        if (isEphemeral) {
          // SIGNALS (Typing/Receipts):
          // Pass opaque RAW bytes. Do not wrap. Do not resolve context.
          wirePayload = optimisticMsg.payloadBytes || new Uint8Array([]);
        } else {
          // CONTENT (Text/Rich):
          // 1. Resolve Context: For Local Broadcast, we simulate 1:1 chats.
          //    The Context is ME (The Sender).
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
          // FAST LANE: Direct to Worker (Bypass DB)
          const recipientUrns = participants.map((p) => p.id);

          this.worker.sendEphemeralBatch(
            recipientUrns,
            optimisticMsg.typeId,
            wirePayload, // Raw
            myUrn,
            myKeys,
          );
          return 'sent';
        }

        // SLOW LANE: Enqueue to DB (Looping for individual 1:1 persistence)
        const loopPromises = participants.map(async (p) => {
          console.log('gb: ', p.id);
          const request: OutboundMessageRequest = {
            conversationUrn: p.id,
            typeId: optimisticMsg.typeId,
            payload: wirePayload, // Wrapped & Resolved
            tags: optimisticMsg.tags || [],
            messageId: `${optimisticMsg.id}-${p.id.toString()}`,
          };

          await this.outboxStorage.enqueue(request);
        });

        await Promise.all(loopPromises);

        return 'pending';
      } catch (err) {
        this.logger.error('[LocalBroadcastStrategy] Failed', err);
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
