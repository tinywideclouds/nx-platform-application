import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  ChatStorageService,
  OutboxStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';

// ✅ CORRECT: Use Directory API for Network Groups
import { DirectoryQueryApi } from '@nx-platform-application/directory-api';

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

  // ✅ FIX: Injected DirectoryQueryApi
  private directoryApi = inject(DirectoryQueryApi);

  private outboxStorage = inject(OutboxStorage);
  private worker = inject(OutboxWorkerService);
  private metadataService = inject(MessageMetadataService);
  private identityResolver = inject(IdentityResolver);

  async send(ctx: SendContext): Promise<OutboundResult> {
    const {
      recipientUrn: networkGroupUrn,
      optimisticMsg,
      shouldPersist,
      isEphemeral,
      myUrn,
      myKeys,
    } = ctx;

    // === 0. Optimistic Persistence ===
    if (shouldPersist) {
      // 1. Fetch the Group Aggregate (Source of Truth)
      const group = await this.directoryApi.getGroup(networkGroupUrn);
      const members = group?.members || [];
      const memberState = group?.memberState || {};

      // 2. Filter Active Members using the Group's State Map
      // We only track receipts for people who have effectively JOINED.
      const activeMembers = members.filter((m) => {
        const status = memberState[m.id.toString()];
        return status === 'joined';
      });

      // ✅ TIER 2 LOGIC: Receipt Tracking (Scorecard)
      if (
        activeMembers.length > 0 &&
        activeMembers.length <= SCALING_POLICY.MAX_RECEIPT_TRACKING
      ) {
        const initialMap: Record<string, MessageDeliveryStatus> = {};
        activeMembers.forEach((m) => (initialMap[m.id.toString()] = 'pending'));
        optimisticMsg.receiptMap = initialMap;
      }
      // If > 50, receiptMap is undefined -> Binary Fallback Mode

      await this.storageService.saveMessage(optimisticMsg);
    }

    const outcomePromise = (async (): Promise<MessageDeliveryStatus> => {
      try {
        // Re-fetch consensus list for transport
        // Note: We send to ALL members in the roster list, even if invited.
        // The protocol might allow lurkers to receive before joining.
        const group = await this.directoryApi.getGroup(networkGroupUrn);
        const members = group?.members || [];

        // === 1. Prepare Wire Format ===
        let wirePayload: Uint8Array;

        if (isEphemeral) {
          wirePayload = optimisticMsg.payloadBytes || new Uint8Array([]);
        } else {
          wirePayload = this.metadataService.wrap(
            optimisticMsg.payloadBytes || new Uint8Array([]),
            networkGroupUrn,
            optimisticMsg.tags || [],
          );
        }

        // === 2. Execution ===
        if (isEphemeral) {
          if (members.length <= MAX_EPHEMERAL_FANOUT) {
            const recipientUrns = members.map((m) => m.id);
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
          conversationUrn: networkGroupUrn,
          typeId: optimisticMsg.typeId,
          payload: wirePayload,
          tags: optimisticMsg.tags || [],
          messageId: optimisticMsg.id,
          recipients: members.map((m) => m.id),
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
