// libs/messenger/chat-state/src/lib/services/chat-outbound.service.ts

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

// Types
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  EncryptedMessagePayload,
  MessageDeliveryStatus,
  DecryptedMessage,
} from '@nx-platform-application/messenger-types';

export interface SendOptions {
  isEphemeral?: boolean;
}

export interface OutboundResult {
  message: DecryptedMessage;
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

  // ✅ CHANGED: Returns object with Message AND Promise
  async send(
    myKeys: PrivateKeys,
    myUrn: URN,
    recipientUrn: URN,
    typeId: URN,
    payloadBytes: Uint8Array,
    options?: SendOptions,
  ): Promise<OutboundResult | null> {
    const isEphemeral = options?.isEphemeral || false;

    try {
      // 1. Resolve Identities
      const targetRoutingUrn =
        await this.identityResolver.resolveToHandle(recipientUrn);
      const storageUrn =
        await this.identityResolver.getStorageUrn(recipientUrn);
      const payloadSenderUrn =
        await this.identityResolver.resolveToHandle(myUrn);

      // 2. Prepare Data
      const timestamp = Temporal.Now.instant().toString() as ISODateTimeString;
      const localId = `local-${crypto.randomUUID()}`;

      // 3. Create Optimistic Message
      const optimisticMsg: DecryptedMessage = {
        messageId: localId,
        senderId: myUrn,
        recipientId: recipientUrn,
        sentTimestamp: timestamp,
        typeId: typeId,
        payloadBytes: payloadBytes,
        status: 'pending',
        conversationUrn: storageUrn,
      };

      // 4. Save Optimistic (Pending)
      if (!isEphemeral) {
        await this.storageService.saveMessage(optimisticMsg);
      }

      // 5. Define the Async Work (The "Outcome")
      const outcomePromise = (async () => {
        try {
          const payload: EncryptedMessagePayload = {
            senderId: payloadSenderUrn,
            sentTimestamp: timestamp,
            typeId: typeId,
            payloadBytes: payloadBytes,
            clientRecordId: isEphemeral ? undefined : localId,
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

          // RACE: Network vs Timeout
          await this.raceNetworkRequest(this.sendService.sendMessage(envelope));

          // SUCCESS
          if (!isEphemeral) {
            await this.storageService.updateMessageStatus([localId], 'sent');
          }
          return 'sent' as MessageDeliveryStatus;
        } catch (err) {
          this.logger.error('[Outbound] Transmission Failed', err);
          // FAIL
          if (!isEphemeral) {
            await this.storageService.updateMessageStatus([localId], 'failed');
          }
          return 'failed' as MessageDeliveryStatus;
        }
      })();

      // 6. Return Immediately (Don't await the outcome)
      return {
        message: optimisticMsg,
        outcome: outcomePromise,
      };
    } catch (error) {
      this.logger.error('[Outbound] Failed to prepare message', error);
      return null;
    }
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
