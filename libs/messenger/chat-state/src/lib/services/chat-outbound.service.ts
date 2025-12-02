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
import { ContactMessengerMapper } from './contact-messenger.mapper';

// Types
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { EncryptedMessagePayload } from '@nx-platform-application/messenger-types';

export interface SendOptions {
  /**
   * If true, the message is treated as a transient signal (e.g., Typing Indicator).
   * It will NOT be stored in the local database and will be flagged as ephemeral
   * for the router (so offline users drop it).
   */
  isEphemeral?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatOutboundService {
  private logger = inject(Logger);
  private sendService = inject(ChatSendService);
  private cryptoService = inject(MessengerCryptoService);
  private storageService = inject(ChatStorageService);
  private keyCache = inject(KeyCacheService);
  private mapper = inject(ContactMessengerMapper);

  /**
   * Encrypts, signs, sends, and locally saves a message.
   * Uses Mapper for BOTH Recipient and Sender resolution.
   */
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
      // 1. Resolve Identities via Mapper
      // We resolve the Recipient to their Routable Handle (e.g. email)
      const targetRoutingUrn = await this.mapper.resolveToHandle(recipientUrn);

      // We resolve the Contact URN to store it against (e.g. local contact ID)
      const storageUrn = await this.mapper.getStorageUrn(recipientUrn);

      // We resolve "Me" to my Public Handle so the recipient knows who I am
      const payloadSenderUrn = await this.mapper.resolveToHandle(myUrn);

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

      // ✅ Apply Ephemeral Flag to Envelope (for Router)
      // This tells the router to drop this message if the user is offline.
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

      // For ephemeral messages, we return the optimistic object
      // just in case the caller needs it, but it's not saved.
      return optimisticMsg;
    } catch (error) {
      this.logger.error('[Outbound] Failed to send message', error);

      // If persistent send failed, the message remains in DB as 'pending' (from step 4).
      // If ephemeral send failed, nothing bad happens (we just return null).
      if (!isEphemeral && optimisticMsg) {
        return optimisticMsg;
      }
      return null;
    }
  }
}
