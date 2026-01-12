import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import {
  ChatStorageService,
  OutboxStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import {
  MessageDeliveryStatus,
  OutboundMessageRequest,
} from '@nx-platform-application/messenger-types';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import {
  SendStrategy,
  SendContext,
  OutboundResult,
} from '../send-strategy.interface';

// Policy: Only track up to 50 active members
const SCALING_POLICY = {
  MAX_RECEIPT_TRACKING: 50,
};

const MAX_EPHEMERAL_FANOUT = 5;

@Injectable({ providedIn: 'root' })
export class NetworkGroupStrategy implements SendStrategy {
  private logger = inject(Logger);
  private storageService = inject(ChatStorageService);
  private contactsApi = inject(ContactsQueryApi);
  private outboxStorage = inject(OutboxStorage);
  private worker = inject(OutboxWorkerService);
  private metadataService = inject(MessageMetadataService);
  private identityResolver = inject(IdentityResolver);

  async send(ctx: SendContext): Promise<OutboundResult> {
    const {
      recipientUrn,
      optimisticMsg,
      shouldPersist,
      isEphemeral,
      myUrn,
      myKeys,
    } = ctx;

    // === 0. Optimistic Persistence (Strategy Owned) ===
    if (shouldPersist) {
      const participants =
        await this.contactsApi.getGroupParticipants(recipientUrn);

      // ✅ TIER 2 LOGIC: Receipt Tracking (Scorecard)
      // Check limits
      if (participants.length <= SCALING_POLICY.MAX_RECEIPT_TRACKING) {
        // FILTER: Only track members who have actually JOINED.
        // We do NOT track 'invited' or 'declined'.
        const activeMembers = participants.filter(
          (p) => p.memberStatus === 'joined' || !p.memberStatus,
        );

        // Initialize Map
        if (activeMembers.length > 0) {
          const initialMap: Record<string, MessageDeliveryStatus> = {};
          activeMembers.forEach(
            (p) => (initialMap[p.id.toString()] = 'pending'),
          );
          optimisticMsg.receiptMap = initialMap;
        }
      }
      // If > 50, receiptMap is undefined -> Binary Fallback Mode

      await this.storageService.saveMessage(optimisticMsg);
    }

    const outcomePromise = (async (): Promise<MessageDeliveryStatus> => {
      try {
        // Re-fetch (or reuse) participants for transport
        // Note: We send to EVERYONE (even invited/lurkers) so they see the message
        // if they decide to join.
        const participants =
          await this.contactsApi.getGroupParticipants(recipientUrn);

        // === 1. Prepare Wire Format ===
        let wirePayload: Uint8Array;

        if (isEphemeral) {
          wirePayload = optimisticMsg.payloadBytes || new Uint8Array([]);
        } else {
          const networkGroupUrn =
            await this.identityResolver.resolveToHandle(recipientUrn);

          wirePayload = this.metadataService.wrap(
            optimisticMsg.payloadBytes || new Uint8Array([]),
            networkGroupUrn,
            optimisticMsg.tags || [],
          );
        }

        // === 2. Execution ===
        if (isEphemeral) {
          if (participants.length <= MAX_EPHEMERAL_FANOUT) {
            const recipientUrns = participants.map((p) => p.id);
            this.worker.sendEphemeralBatch(
              recipientUrns,
              optimisticMsg.typeId,
              wirePayload,
              myUrn,
              myKeys,
            );
          }
          return 'sent';
        }

        const request: OutboundMessageRequest = {
          conversationUrn: recipientUrn,
          typeId: optimisticMsg.typeId,
          payload: wirePayload,
          tags: optimisticMsg.tags || [],
          messageId: optimisticMsg.id,
          recipients: participants.map((p) => p.id),
        };

        await this.outboxStorage.enqueue(request);

        return 'pending';
      } catch (err) {
        this.logger.error('[NetworkGroupStrategy] Failed', err);
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
