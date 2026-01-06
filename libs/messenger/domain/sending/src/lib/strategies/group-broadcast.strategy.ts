import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import {
  ChatStorageService,
  OutboxStorage,
  OutboundMessageRequest,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import {
  MessageMetadataService,
  messageTagBroadcast,
} from '@nx-platform-application/messenger-domain-message-content';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import {
  MessageDeliveryStatus,
  ChatMessage,
} from '@nx-platform-application/messenger-types';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { SendStrategy, SendContext } from '../send-strategy.interface';
import { OutboundResult } from '../send-strategy.interface';

// ✅ FORMAL DIVISION: Scaling Policies
const SCALING_POLICY = {
  // Tier 1: Full History (Ghosts) + Full Tracking
  MAX_GHOSTING: 10,
  // Tier 2: Full Tracking (Receipt Map)
  MAX_RECEIPT_TRACKING: 50,
  // Tier 3: Binary Status Only
};

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

    // Inject Broadcast Tag
    const tags = optimisticMsg.tags || [];
    if (!tags.some((t) => t.toString() === messageTagBroadcast.toString())) {
      tags.push(messageTagBroadcast);
      optimisticMsg.tags = tags;
    }

    // === 0. Optimistic Persistence (Strategy Owned) ===
    if (!isEphemeral) {
      const participants =
        await this.contactsApi.getGroupParticipants(recipientUrn);

      // ✅ POLICY CHECK: Receipt Tracking (Tier 1 & 2)
      if (participants.length <= SCALING_POLICY.MAX_RECEIPT_TRACKING) {
        const initialMap: Record<string, MessageDeliveryStatus> = {};
        participants.forEach((p) => (initialMap[p.id.toString()] = 'pending'));
        optimisticMsg.receiptMap = initialMap;
      }
      // Else: Tier 3 (Large) -> receiptMap remains undefined (triggers Binary Mode in Storage)

      // Save Main Message (Source of Truth)
      await this.storageService.saveMessage(optimisticMsg);

      // ✅ POLICY CHECK: Ghosting (Tier 1 Only)
      if (participants.length <= SCALING_POLICY.MAX_GHOSTING) {
        try {
          const ghosts = participants.map((p) => {
            const ghostMsg: ChatMessage = {
              ...optimisticMsg,
              id: `ghost-${crypto.randomUUID()}`,
              conversationUrn: p.id,
              status: 'reference',
              tags: [
                ...tags,
                `urn:messenger:ghost-of:${optimisticMsg.id}`,
              ] as any,
            };
            return ghostMsg;
          });

          await Promise.all(
            ghosts.map((g) => this.storageService.saveMessage(g)),
          ).catch((err) =>
            this.logger.warn('[LocalBroadcastStrategy] Ghosting failed', err),
          );
        } catch (err) {
          this.logger.warn(
            '[LocalBroadcastStrategy] Failed to fetch participants for ghosting',
            err,
          );
        }
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

        // SLOW LANE: Enqueue to DB
        const loopPromises = participants.map(async (p) => {
          const request: OutboundMessageRequest = {
            conversationUrn: p.id,
            typeId: optimisticMsg.typeId,
            payload: wirePayload,
            tags: optimisticMsg.tags || [],
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
