import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';
import { Temporal } from '@js-temporal/polyfill';

import { ChatSendService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import {
  MessageMetadataService,
  MESSAGE_TYPE_TEXT,
} from '@nx-platform-application/messenger-domain-message-content';

// ✅ ARCHITECTURE FIX: Import Contract from Infrastructure
import { OutboxStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';

import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';

import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  TransportMessage,
  MessageDeliveryStatus,
  ChatMessage,
  OutboundTask,
} from '@nx-platform-application/messenger-types';

export interface SendOptions {
  isEphemeral?: boolean;
  tags?: URN[];
}

export interface OutboundResult {
  message: ChatMessage;
  outcome: Promise<MessageDeliveryStatus>;
}

const SEND_TIMEOUT_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class OutboundService {
  private logger = inject(Logger);
  private sendService = inject(ChatSendService);
  private cryptoService = inject(MessengerCryptoService);
  private storageService = inject(ChatStorageService);
  private keyCache = inject(KeyCacheService);
  private identityResolver = inject(IdentityResolver);
  private outboxStorage = inject(OutboxStorage);
  private outboxWorker = inject(OutboxWorkerService);
  private contactsState = inject(ContactsStateService);
  private metadataService = inject(MessageMetadataService);

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
      const storageUrn =
        await this.identityResolver.getStorageUrn(recipientUrn);
      const timestamp = Temporal.Now.instant().toString() as ISODateTimeString;
      const localId = `local-${crypto.randomUUID()}`;

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

      if (!isEphemeral) {
        await this.storageService.saveMessage(optimisticMsg);
      }

      if (this.isGroup(recipientUrn)) {
        return this.handleGroupFanout(
          myKeys,
          myUrn,
          recipientUrn,
          optimisticMsg,
          isEphemeral,
        );
      } else {
        return this.handleDirectSend(
          myKeys,
          myUrn,
          recipientUrn,
          optimisticMsg,
          isEphemeral,
        );
      }
    } catch (error) {
      this.logger.error('[Outbound] Failed to prepare message', error);
      return null;
    }
  }

  private isGroup(urn: URN): boolean {
    return urn.toString().startsWith('urn:messenger:group:');
  }

  private async handleGroupFanout(
    myKeys: PrivateKeys,
    myUrn: URN,
    groupUrn: URN,
    msg: ChatMessage,
    isEphemeral: boolean,
  ): Promise<OutboundResult> {
    const outcomePromise = (async () => {
      try {
        const participants =
          await this.contactsState.getGroupParticipants(groupUrn);

        const finalPayload = isEphemeral
          ? msg.payloadBytes || new Uint8Array([])
          : this.metadataService.wrap(
              msg.payloadBytes || new Uint8Array([]),
              msg.conversationUrn,
              msg.tags || [],
            );

        const task: OutboundTask = {
          id: crypto.randomUUID(),
          messageId: msg.id,
          conversationUrn: groupUrn,
          typeId: msg.typeId,
          payload: finalPayload,
          tags: msg.tags || [],
          status: 'queued',
          createdAt: msg.sentTimestamp,
          recipients: participants.map((p) => ({
            urn: p.id,
            status: 'pending',
            attempts: 0,
          })),
        };

        await this.outboxStorage.addTask(task);
        this.outboxWorker.processQueue(myUrn, myKeys);

        return 'sent' as MessageDeliveryStatus;
      } catch (err) {
        this.logger.error('[Outbound] Group Staging Failed', err);
        if (!isEphemeral) {
          await this.storageService.updateMessageStatus([msg.id], 'failed');
        }
        return 'failed' as MessageDeliveryStatus;
      }
    })();

    return { message: msg, outcome: outcomePromise };
  }

  private async handleDirectSend(
    myKeys: PrivateKeys,
    myUrn: URN,
    recipientUrn: URN,
    msg: ChatMessage,
    isEphemeral: boolean,
  ): Promise<OutboundResult> {
    const outcomePromise = (async () => {
      try {
        const targetRoutingUrn =
          await this.identityResolver.resolveToHandle(recipientUrn);
        const payloadSenderUrn =
          await this.identityResolver.resolveToHandle(myUrn);

        const transportPayloadBytes = isEphemeral
          ? msg.payloadBytes || new Uint8Array([])
          : this.metadataService.wrap(
              msg.payloadBytes || new Uint8Array([]),
              msg.conversationUrn,
              msg.tags || [],
            );

        const payload: TransportMessage = {
          senderId: payloadSenderUrn,
          sentTimestamp: msg.sentTimestamp,
          typeId: msg.typeId,
          payloadBytes: transportPayloadBytes,
          clientRecordId: isEphemeral ? undefined : msg.id,
        };

        const recipientKeys =
          await this.keyCache.getPublicKey(targetRoutingUrn);
        const envelope = await this.cryptoService.encryptAndSign(
          payload,
          targetRoutingUrn,
          myKeys,
          recipientKeys,
        );

        if (isEphemeral) {
          envelope.isEphemeral = true;
        }

        await this.raceNetworkRequest(this.sendService.sendMessage(envelope));

        if (!isEphemeral) {
          await this.storageService.updateMessageStatus([msg.id], 'sent');
        }
        return 'sent' as MessageDeliveryStatus;
      } catch (err) {
        this.logger.error('[Outbound] Transmission Failed', err);
        if (!isEphemeral) {
          await this.storageService.updateMessageStatus([msg.id], 'failed');
        }
        return 'failed' as MessageDeliveryStatus;
      }
    })();

    return { message: msg, outcome: outcomePromise };
  }

  private raceNetworkRequest(observable$: any): Promise<void> {
    const request = firstValueFrom<void>(observable$);
    const timer = new Promise<void>((_, reject) =>
      setTimeout(
        () => reject(new Error('Send Timeout (30s)')),
        SEND_TIMEOUT_MS,
      ),
    );
    return Promise.race([request, timer]);
  }
}
