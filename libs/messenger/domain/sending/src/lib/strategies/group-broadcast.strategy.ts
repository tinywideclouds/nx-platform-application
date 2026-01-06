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
import {
  MessageDeliveryStatus,
  ChatMessage,
} from '@nx-platform-application/messenger-types';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { SendStrategy, SendContext } from '../send-strategy.interface';
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

    // === 0. Optimistic Persistence (Strategy Owned) ===
    if (!isEphemeral) {
      // 1. Save the Source of Truth (Group Message)
      await this.storageService.saveMessage(optimisticMsg);

      // 2. Ghosting Logic (Shadow copies for 1:1 history)
      try {
        const participants =
          await this.contactsApi.getGroupParticipants(recipientUrn);

        // Safety Cap: Don't flood DB for mass broadcasts > 10
        if (participants.length <= 10) {
          const ghosts = participants.map((p) => {
            const ghostMsg: ChatMessage = {
              ...optimisticMsg,
              // NEW Identity
              id: `ghost-${crypto.randomUUID()}`,
              // 1:1 Context
              conversationUrn: p.id,
              // Reference Status (No delivery tracking)
              status: 'reference',
              // Link back to original
              tags: [
                ...(optimisticMsg.tags || []),
                `urn:messenger:ghost-of:${optimisticMsg.id}`,
              ] as any,
            };
            return ghostMsg;
          });

          // Parallel Save (Fire & Forget - don't block main flow if ghosts fail)
          await Promise.all(
            ghosts.map((g) => this.storageService.saveMessage(g)),
          ).catch((err) =>
            this.logger.warn('[LocalBroadcastStrategy] Ghosting failed', err),
          );
        }
      } catch (err) {
        // Non-critical error
        this.logger.warn(
          '[LocalBroadcastStrategy] Failed to fetch participants for ghosting',
          err,
        );
      }
    }

    const outcomePromise = (async (): Promise<MessageDeliveryStatus> => {
      try {
        const participants =
          await this.contactsApi.getGroupParticipants(recipientUrn);

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
          const recipientUrns = participants.map((p) => p.id);
          this.worker.sendEphemeralBatch(
            recipientUrns,
            optimisticMsg.typeId,
            wirePayload,
            myUrn,
            myKeys,
          );
          return 'sent';
        }

        // SLOW LANE: Enqueue to DB (Looping for individual 1:1 persistence)
        const loopPromises = participants.map(async (p) => {
          const request: OutboundMessageRequest = {
            conversationUrn: p.id,
            typeId: optimisticMsg.typeId,
            payload: wirePayload,
            tags: optimisticMsg.tags || [],
            // Use fresh ID for task, link to SOT via parentMessageId
            messageId: crypto.randomUUID(),
            parentMessageId: optimisticMsg.id,
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
