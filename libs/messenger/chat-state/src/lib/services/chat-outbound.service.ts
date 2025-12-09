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
import {
  ChatStorageService,
  DecryptedMessage,
} from '@nx-platform-application/chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';

// [Refactor] Use the new Adapter Interface
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

@Injectable({ providedIn: 'root' })
export class ChatOutboundService {
  private logger = inject(Logger);
  private sendService = inject(ChatSendService);
  private cryptoService = inject(MessengerCryptoService);
  private storageService = inject(ChatStorageService);
  private keyCache = inject(KeyCacheService);

  // [Refactor] Inject the interface, not the concrete class
  private identityResolver = inject(IdentityResolver);

  async send(
    myKeys: PrivateKeys,
    myUrn: URN,
    recipientUrn: URN,
    typeId: URN,
    payloadBytes: Uint8Array,
    options?: SendOptions
  ): Promise<DecryptedMessage | null> {
    let optimisticMsg: DecryptedMessage | null = null;
    const isEphemeral = options?.isEphemeral || false;

    try {
      // 1. Resolve Identities via Adapter
      // We resolve the Recipient to their Routable Handle (e.g. email)
      const targetRoutingUrn = await this.identityResolver.resolveToHandle(
        recipientUrn
      );

      // We resolve the Contact URN to store it against (e.g. local contact ID)
      const storageUrn = await this.identityResolver.getStorageUrn(
        recipientUrn
      );

      // We resolve "Me" to my Public Handle so the recipient knows who I am
      const payloadSenderUrn = await this.identityResolver.resolveToHandle(
        myUrn
      );

      if (!isEphemeral) {
        this.logger.debug(
          `[Outbound] Routing To: ${targetRoutingUrn.toString()}`
        );
        this.logger.debug(
          `[Outbound] Sending As: ${payloadSenderUrn.toString()}`
        );
      }

      // 2. Construct Payload (Network Identity)
      const timestamp = Temporal.Now.instant().toString() as ISODateTimeString;
      const payload: EncryptedMessagePayload = {
        senderId: payloadSenderUrn,
        sentTimestamp: timestamp,
        typeId: typeId,
        payloadBytes: payloadBytes,
      };

      // 3. Create Optimistic Message (Local Identity)
      optimisticMsg = {
        messageId: `local-${crypto.randomUUID()}`,
        senderId: myUrn,
        recipientId: recipientUrn,
        sentTimestamp: payload.sentTimestamp,
        typeId: payload.typeId,
        payloadBytes: payload.payloadBytes,
        status: 'pending',
        conversationUrn: storageUrn,
      };

      // 4. SAVE IMMEDIATELY (Skip if Ephemeral)
      if (!isEphemeral) {
        await this.storageService.saveMessage(optimisticMsg);
      }

      // 5. Encrypt & Sign
      const recipientKeys = await this.keyCache.getPublicKey(targetRoutingUrn);
      const envelope = await this.cryptoService.encryptAndSign(
        payload,
        targetRoutingUrn,
        myKeys,
        recipientKeys
      );

      if (isEphemeral) {
        envelope.isEphemeral = true;
      }

      // 6. Send to Network
      await firstValueFrom(this.sendService.sendMessage(envelope));

      // 7. Update Status (Skip if Ephemeral)
      if (!isEphemeral) {
        const sentMsg: DecryptedMessage = {
          ...optimisticMsg,
          status: 'sent',
        };
        await this.storageService.saveMessage(sentMsg);
        return sentMsg;
      }

      return optimisticMsg;
    } catch (error) {
      this.logger.error('[Outbound] Failed to send message', error);

      if (!isEphemeral && optimisticMsg) {
        return optimisticMsg;
      }
      return null;
    }
  }
}
