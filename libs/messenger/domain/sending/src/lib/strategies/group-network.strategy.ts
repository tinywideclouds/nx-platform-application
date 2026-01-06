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
import { SendStrategy, SendContext } from '../send-strategy.interface';
import { OutboundResult } from '../outbound.service';

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
    const { recipientUrn, optimisticMsg, isEphemeral, myUrn, myKeys } = ctx;

    // === 0. Optimistic Persistence (Strategy Owned) ===
    if (!isEphemeral) {
      // Network Group: 1 Message (to Group) -> 1 Record
      await this.storageService.saveMessage(optimisticMsg);
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
        await this.storageService.updateMessageStatus(
          [optimisticMsg.id],
          'failed',
        );
        return 'failed';
      }
    })();

    return { message: optimisticMsg, outcome: outcomePromise };
  }
}
