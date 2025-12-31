import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';
import { Temporal } from '@js-temporal/polyfill';

// Services
import { ChatSendService } from '@nx-platform-application/chat-access';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { IdentityResolver } from '@nx-platform-application/messenger-identity-adapter';
import {
  OutboxRepository,
  OutboxWorkerService,
  OutboundTask,
} from '@nx-platform-application/messenger-outbox';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import {
  MessageMetadataService,
  MESSAGE_TYPE_TEXT,
} from '@nx-platform-application/message-content';

// Types
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  TransportMessage,
  MessageDeliveryStatus,
  ChatMessage, // ✅ Domain Object
} from '@nx-platform-application/messenger-types';

export interface SendOptions {
  isEphemeral?: boolean;
  tags?: URN[];
}

export interface OutboundResult {
  message: ChatMessage; // ✅ Returns Domain Object
  outcome: Promise<MessageDeliveryStatus>;
}

const SEND_TIMEOUT_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class ChatOutboundService {
  private logger = inject(Logger);
  private sendService = inject(ChatSendService);
  private cryptoService = inject(MessengerCryptoService);
  private storageService = inject(ChatStorageService);
  private keyCache = inject(KeyCacheService);
  private identityResolver = inject(IdentityResolver);
  private outboxRepo = inject(OutboxRepository);
  private outboxWorker = inject(OutboxWorkerService);
  private contactsState = inject(ContactsStateService);
  private metadataService = inject(MessageMetadataService);

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
      // 1. Resolve Routing
      const storageUrn =
        await this.identityResolver.getStorageUrn(recipientUrn);
      const timestamp = Temporal.Now.instant().toString() as ISODateTimeString;
      const localId = `local-${crypto.randomUUID()}`;

      // 2. Create Optimistic Domain Object (ChatMessage)
      // This is what the UI displays immediately.
      // It holds RAW content and SEPARATE tags.
      const optimisticMsg: ChatMessage = {
        id: localId,
        senderId: myUrn,
        // For 1:1, conversation is partner. For Group, it's the group URN.
        conversationUrn: storageUrn,
        sentTimestamp: timestamp,
        typeId: typeId,

        // ✅ Domain State: Keep content and metadata separate
        payloadBytes: originalPayloadBytes,
        tags: tags,

        // ✅ UI Optimization: Pre-decode text for immediate display
        textContent:
          typeId.toString() === MESSAGE_TYPE_TEXT
            ? new TextDecoder().decode(originalPayloadBytes)
            : undefined,

        status: 'pending',
      };

      // 3. Save Optimistic (Pending)
      if (!isEphemeral) {
        await this.storageService.saveMessage(optimisticMsg);
      }

      // 4. Divert: Group vs 1-to-1
      if (this.isGroup(recipientUrn)) {
        return this.handleGroupFanout(
          myKeys,
          myUrn,
          recipientUrn, // Pass the Group URN
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

        // Queue the task with RAW bytes.
        // The Worker will handle wrapping per recipient (or once for the batch).
        const task: OutboundTask = {
          id: crypto.randomUUID(),
          messageId: msg.id,
          conversationUrn: groupUrn,
          typeId: msg.typeId,
          payload: msg.payloadBytes || new Uint8Array([]),
          tags: msg.tags || [],
          status: 'queued',
          createdAt: msg.sentTimestamp,
          recipients: participants.map((p) => ({
            urn: p.id,
            status: 'pending',
            attempts: 0,
          })),
        };

        await this.outboxRepo.addTask(task);
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

        // ✅ CRITICAL: Wrap Payload for Transport
        // The network payload gets the metadata-wrapped bytes.
        const wrappedPayloadBytes = this.metadataService.wrap(
          msg.payloadBytes || new Uint8Array([]),
          msg.conversationUrn, // SOT: The receiver uses this to route
          msg.tags || [],
        );

        const payload: TransportMessage = {
          senderId: payloadSenderUrn,
          sentTimestamp: msg.sentTimestamp,
          typeId: msg.typeId,
          payloadBytes: wrappedPayloadBytes, // <-- Wrapped
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

        if (isEphemeral) envelope.isEphemeral = true;

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
