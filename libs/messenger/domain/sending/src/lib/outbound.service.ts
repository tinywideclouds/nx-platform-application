import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { Temporal } from '@js-temporal/polyfill';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
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
import { MESSAGE_TYPE_TEXT } from '@nx-platform-application/messenger-domain-message-content';

// Strategies
import { SendContext } from './strategies/send-strategy.interface';
import { DirectSendStrategy } from './strategies/direct-send.strategy';
import { NetworkGroupStrategy } from './strategies/group-network.strategy';
import { LocalBroadcastStrategy } from './strategies/group-broadcast.strategy';

export interface SendOptions {
  isEphemeral?: boolean;
  tags?: URN[];
}

export interface OutboundResult {
  message: ChatMessage;
  outcome: Promise<MessageDeliveryStatus>;
}

@Injectable({ providedIn: 'root' })
export class OutboundService {
  private logger = inject(Logger);
  private storageService = inject(ChatStorageService);
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
      const isNetworkGroup = recipientUrn
        .toString()
        .startsWith('urn:messenger:group:');
      const isLocalGroup = recipientUrn
        .toString()
        .startsWith('urn:contacts:group:');

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
        textContent:
          typeId.toString() === MESSAGE_TYPE_TEXT
            ? new TextDecoder().decode(originalPayloadBytes)
            : undefined,
        status: 'pending',
      };

      // Persist to UI storage immediately (unless ephemeral)
      if (!isEphemeral) {
        await this.storageService.saveMessage(optimisticMsg);
      }

      const context: SendContext = {
        myKeys,
        myUrn,
        recipientUrn,
        optimisticMsg,
        isEphemeral,
      };

      // 1. Execute Strategy (Enqueue or Bypass)
      let result: OutboundResult;

      console.log('decide strategy');

      if (isNetworkGroup) {
        result = await this.networkStrategy.send(context);
      } else if (isLocalGroup) {
        result = await this.broadcastStrategy.send(context);
      } else {
        result = await this.directStrategy.send(context);
      }

      // 2. Trigger Worker (Standard Persistent Messages Only)
      // The strategy only queues the task. We must wake up the worker to process it.
      if (!isEphemeral) {
        // Note: For Groups, we use 'myUrn' as the Sender context for key retrieval
        this.outboxWorker.processQueue(myUrn, myKeys);
      }

      return result;
    } catch (error) {
      this.logger.error('[Outbound] Failed to coordinate send', error);
      return null;
    }
  }
}
