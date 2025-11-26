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
    payloadBytes: Uint8Array
  ): Promise<DecryptedMessage | null> {
    let optimisticMsg: DecryptedMessage | null = null;

    try {
      // 1. Resolve Identities via Mapper
      const targetRoutingUrn = await this.mapper.resolveToHandle(recipientUrn);
      const storageUrn = await this.mapper.getStorageUrn(recipientUrn);

      // FIX: Ask Mapper how "I" should be represented on the network
      const payloadSenderUrn = await this.mapper.resolveToHandle(myUrn);

      this.logger.debug(
        `[Outbound] Routing To: ${targetRoutingUrn.toString()}`
      );
      this.logger.debug(
        `[Outbound] Sending As: ${payloadSenderUrn.toString()}`
      );

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

      // 4. SAVE IMMEDIATELY
      await this.storageService.saveMessage(optimisticMsg);

      // 5. Encrypt & Send
      const recipientKeys = await this.keyCache.getPublicKey(targetRoutingUrn);
      const envelope = await this.cryptoService.encryptAndSign(
        payload,
        targetRoutingUrn,
        myKeys,
        recipientKeys
      );

      await firstValueFrom(this.sendService.sendMessage(envelope));

      // 6. Update Status
      const sentMsg: DecryptedMessage = {
        ...optimisticMsg,
        status: 'sent',
      };
      await this.storageService.saveMessage(sentMsg);

      return sentMsg;
    } catch (error) {
      this.logger.error('[Outbound] Failed to send message', error);
      if (optimisticMsg) return optimisticMsg;
      return null;
    }
  }
}
