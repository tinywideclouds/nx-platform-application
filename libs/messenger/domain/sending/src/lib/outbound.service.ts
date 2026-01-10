import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { Temporal } from '@js-temporal/polyfill';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  MessageDeliveryStatus,
  ChatMessage,
} from '@nx-platform-application/messenger-types';
import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';

// Strategies
import { SendContext } from './send-strategy.interface';
import { DirectSendStrategy } from './strategies/direct-send.strategy';
import { NetworkGroupStrategy } from './strategies/group-network.strategy';
import { LocalBroadcastStrategy } from './strategies/group-broadcast.strategy';
import { OutboundResult, SendOptions } from './send-strategy.interface';

@Injectable({ providedIn: 'root' })
export class OutboundService {
  private logger = inject(Logger);
  private identityResolver = inject(IdentityResolver);
  private outboxWorker = inject(OutboxWorkerService);

  private directStrategy = inject(DirectSendStrategy);
  private networkStrategy = inject(NetworkGroupStrategy);
  private broadcastStrategy = inject(LocalBroadcastStrategy);

  public triggerQueueProcessing(senderUrn: URN, myKeys: PrivateKeys): void {
    this.outboxWorker.processQueue(senderUrn, myKeys);
  }

  async sendMessage(
    myKeys: PrivateKeys,
    myUrn: URN,
    recipientUrn: URN,
    typeId: URN,
    originalPayloadBytes: Uint8Array,
    options?: SendOptions,
  ): Promise<OutboundResult | null> {
    const isEphemeral = options?.isEphemeral || false;
    const tags = options?.tags || [];

    try {
      const isGroup = recipientUrn.entityType === 'group';
      const isNetworkGroup = isGroup && recipientUrn.namespace === 'messenger';
      const isLocalGroup = isGroup && recipientUrn.namespace === 'contacts';

      // Resolve Storage Location
      const storageUrn = isLocalGroup
        ? recipientUrn
        : await this.identityResolver.getStorageUrn(recipientUrn);

      const timestamp = Temporal.Now.instant().toString() as ISODateTimeString;
      const localId = `local-${crypto.randomUUID()}`;

      // Create Optimistic Record
      const optimisticMsg: ChatMessage = {
        id: localId,
        senderId: myUrn,
        conversationUrn: storageUrn,
        sentTimestamp: timestamp,
        typeId: typeId,
        payloadBytes: originalPayloadBytes,
        tags: tags,
        textContent: typeId.equals(MessageTypeText)
          ? new TextDecoder().decode(originalPayloadBytes)
          : undefined,
        status: 'pending',
      };

      // ❌ REMOVED: Global save logic.
      // Persistence is now the responsibility of the selected strategy.

      const context: SendContext = {
        myKeys,
        myUrn,
        recipientUrn,
        optimisticMsg,
        isEphemeral,
      };

      let result: OutboundResult;

      // 1. Execute Strategy (Includes Persistence)
      if (isNetworkGroup) {
        result = await this.networkStrategy.send(context);
      } else if (isLocalGroup) {
        result = await this.broadcastStrategy.send(context);
      } else {
        result = await this.directStrategy.send(context);
      }

      // 2. Trigger Worker
      if (!isEphemeral) {
        // Await persistence confirmation before processing
        await result.outcome;
        this.outboxWorker.processQueue(myUrn, myKeys);
      }

      return result;
    } catch (error) {
      this.logger.error('[Outbound] Failed to coordinate send', error);
      return null;
    }
  }
}
