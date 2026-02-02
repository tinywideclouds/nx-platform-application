import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { Temporal } from '@js-temporal/polyfill';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';
// ✅ MOVED HERE: Service Layer handles data resolution
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';

import {
  SendContext,
  SendOptions,
  OutboundResult,
} from './send-strategy.interface';
import { DirectSendStrategy } from './strategies/direct-send.strategy';
import { NetworkGroupStrategy } from './strategies/group-network.strategy';
import { LocalBroadcastStrategy } from './strategies/group-broadcast.strategy';

@Injectable({ providedIn: 'root' })
export class OutboundService {
  private logger = inject(Logger);
  private outboxWorker = inject(OutboxWorkerService);
  private contactsQuery = inject(ContactsQueryApi);

  private directStrategy = inject(DirectSendStrategy);
  private networkStrategy = inject(NetworkGroupStrategy);
  private broadcastStrategy = inject(LocalBroadcastStrategy);

  /**
   * FACADE 1: Standard Chat
   * "I am in a conversation window, send this message."
   */
  async sendToConversation(
    myKeys: PrivateKeys,
    myUrn: URN,
    conversationUrn: URN,
    typeId: URN,
    payloadBytes: Uint8Array,
    options: SendOptions = {},
  ): Promise<OutboundResult> {
    // 1. Prepare Context
    const ctx = this.createContext(
      myKeys,
      myUrn,
      conversationUrn,
      typeId,
      payloadBytes,
      options,
    );

    let result: OutboundResult;

    // 2. Route based on URN Type
    if (conversationUrn.entityType === 'group') {
      if (conversationUrn.namespace === 'messenger') {
        // A. Network Group -> Network Strategy
        result = await this.networkStrategy.send(ctx);
      } else {
        // B. Local Group -> Resolve & Broadcast
        const members =
          await this.contactsQuery.getGroupParticipants(conversationUrn);
        ctx.recipients = members.map((c) => c.id); // Feed the dumb strategy
        result = await this.broadcastStrategy.send(ctx);
      }
    } else {
      // C. User -> Direct Strategy
      result = await this.directStrategy.send(ctx);
    }

    this.processPostSend(result, options.isEphemeral, myUrn, myKeys);
    return result;
  }

  /**
   * FACADE 2: Explicit Broadcast / Invite
   * "Send this payload to these specific people, but store it in this context."
   */
  async broadcast(
    myKeys: PrivateKeys,
    myUrn: URN,
    recipients: URN[], // ✅ Explicit List
    contextUrn: URN, // ✅ History Context
    typeId: URN,
    payloadBytes: Uint8Array,
    options: SendOptions = {},
  ): Promise<OutboundResult> {
    const ctx = this.createContext(
      myKeys,
      myUrn,
      contextUrn,
      typeId,
      payloadBytes,
      options,
    );

    // ✅ Feed the dumb strategy explicitly
    ctx.recipients = recipients;

    const result = await this.broadcastStrategy.send(ctx);

    this.processPostSend(result, options.isEphemeral, myUrn, myKeys);
    return result;
  }

  // --- Helpers ---

  private createContext(
    myKeys: PrivateKeys,
    myUrn: URN,
    conversationUrn: URN,
    typeId: URN,
    payloadBytes: Uint8Array,
    options: SendOptions,
  ): SendContext {
    const timestamp = Temporal.Now.instant().toString() as ISODateTimeString;

    const optimisticMsg: ChatMessage = {
      id: `msg-${crypto.randomUUID()}`,
      senderId: myUrn,
      conversationUrn: conversationUrn,
      sentTimestamp: timestamp,
      typeId: typeId,
      payloadBytes: payloadBytes,
      tags: options.tags || [],
      textContent: typeId.equals(MessageTypeText)
        ? new TextDecoder().decode(payloadBytes)
        : undefined,
      status: 'pending',
    };

    return {
      myKeys,
      myUrn,
      recipientUrn: conversationUrn,
      optimisticMsg,
      isEphemeral: options.isEphemeral ?? false,
      shouldPersist: options.shouldPersist ?? true,
      // recipients is undefined by default, populated by Facade
    };
  }

  private async processPostSend(
    result: OutboundResult,
    isEphemeral: boolean | undefined,
    myUrn: URN,
    myKeys: PrivateKeys,
  ) {
    if (!isEphemeral) {
      await result.outcome;
      this.outboxWorker.processQueue(myUrn, myKeys);
    }
  }
}
