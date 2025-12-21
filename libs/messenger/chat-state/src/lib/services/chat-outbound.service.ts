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
import { DecryptedMessage } from '@nx-platform-application/messenger-types';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { IdentityResolver } from '@nx-platform-application/messenger-identity-adapter';

// Types
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { EncryptedMessagePayload } from '@nx-platform-application/messenger-types';

export interface SendOptions {
  isEphemeral?: boolean;
}

// 30 Seconds Timeout for "Stalled" state
const SEND_TIMEOUT_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class ChatOutboundService {
  private logger = inject(Logger);
  private sendService = inject(ChatSendService);
  private cryptoService = inject(MessengerCryptoService);
  private storageService = inject(ChatStorageService);
  private keyCache = inject(KeyCacheService);
  private identityResolver = inject(IdentityResolver);

  async send(
    myKeys: PrivateKeys,
    myUrn: URN,
    recipientUrn: URN,
    typeId: URN,
    payloadBytes: Uint8Array,
    options?: SendOptions,
  ): Promise<DecryptedMessage | null> {
    let optimisticMsg: DecryptedMessage | null = null;
    const isEphemeral = options?.isEphemeral || false;

    try {
      // 1. Resolve Identities
      const targetRoutingUrn =
        await this.identityResolver.resolveToHandle(recipientUrn);
      const storageUrn =
        await this.identityResolver.getStorageUrn(recipientUrn);
      const payloadSenderUrn =
        await this.identityResolver.resolveToHandle(myUrn);

      if (!isEphemeral) {
        this.logger.debug(
          `[Outbound] Routing To: ${targetRoutingUrn.toString()}`,
        );
      }

      // 2. Prepare Timestamps & IDs
      const timestamp = Temporal.Now.instant().toString() as ISODateTimeString;
      const localId = `local-${crypto.randomUUID()}`;

      // 3. Create Optimistic Message (Local Identity)
      optimisticMsg = {
        messageId: localId,
        senderId: myUrn,
        recipientId: recipientUrn,
        sentTimestamp: timestamp,
        typeId: typeId,
        payloadBytes: payloadBytes,
        status: 'pending',
        conversationUrn: storageUrn,
      };

      // 4. Construct Payload (Network Identity)
      const payload: EncryptedMessagePayload = {
        senderId: payloadSenderUrn,
        sentTimestamp: timestamp,
        typeId: typeId,
        payloadBytes: payloadBytes,
        clientRecordId: isEphemeral ? undefined : localId,
      };

      // 5. SAVE IMMEDIATELY (Skip if Ephemeral)
      if (!isEphemeral) {
        await this.storageService.saveMessage(optimisticMsg);
      }

      // 6. Encrypt & Sign
      const recipientKeys = await this.keyCache.getPublicKey(targetRoutingUrn);
      const envelope = await this.cryptoService.encryptAndSign(
        payload,
        targetRoutingUrn,
        myKeys,
        recipientKeys,
      );

      if (isEphemeral) {
        envelope.isEphemeral = true;
      }

      // 7. Send to Network (With Race Condition)
      await this.raceNetworkRequest(this.sendService.sendMessage(envelope));

      // 8. Update Status (Skip if Ephemeral)
      if (!isEphemeral && optimisticMsg) {
        // 'failed' is a valid MessageDeliveryStatus
        await this.storageService.updateMessageStatus(
          [optimisticMsg.messageId],
          'failed',
        );
        return { ...optimisticMsg, status: 'failed' };
      }

      return optimisticMsg;
    } catch (error) {
      this.logger.error('[Outbound] Failed to send message', error);

      // ✅ FAILURE HANDLING
      if (!isEphemeral && optimisticMsg) {
        // Mark as failed in storage so UI can show "Retry"
        await this.storageService.updateMessageStatus(
          [optimisticMsg.messageId],
          'failed',
        );
        return { ...optimisticMsg, status: 'failed' };
      }
      return null;
    }
  }

  // Helper to race the request against a timeout
  private raceNetworkRequest(observable$: any): Promise<void> {
    // We explicitly tell TS that this Observable yields 'void' (or we don't care about the value)
    const request = firstValueFrom<void>(observable$);

    const timer = new Promise<void>((_, reject) =>
      setTimeout(
        () => reject(new Error('Send Timeout (30s)')),
        SEND_TIMEOUT_MS,
      ),
    );

    // Now both inputs are Promise<void>, so the output is Promise<void>
    return Promise.race([request, timer]);
  }
}
