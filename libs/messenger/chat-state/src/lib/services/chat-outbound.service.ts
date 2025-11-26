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
   * Returns the optimistic DecryptedMessage for UI updates.
   */
  async send(
    myKeys: PrivateKeys,
    myUrn: URN, // My Auth URN
    recipientUrn: URN, // Contact OR Auth URN
    typeId: URN,
    payloadBytes: Uint8Array
  ): Promise<DecryptedMessage | null> {
    try {
      // 1. Resolve Recipient to Handle (for Routing/Encryption)
      // If recipientUrn is a Contact, this returns the Handle.
      // If recipientUrn is a Handle, it returns it as-is.
      const targetRoutingUrn = await this.mapper.resolveToHandle(recipientUrn);

      // 2. Construct Payload
      const payload: EncryptedMessagePayload = {
        senderId: myUrn,
        sentTimestamp: Temporal.Now.instant().toString() as ISODateTimeString,
        typeId: typeId,
        payloadBytes: payloadBytes,
      };

      // 3. Fetch Keys & Encrypt (using Routing URN)
      const recipientKeys = await this.keyCache.getPublicKey(targetRoutingUrn);
      const envelope = await this.cryptoService.encryptAndSign(
        payload,
        targetRoutingUrn,
        myKeys,
        recipientKeys
      );

      // 4. Network Send
      await firstValueFrom(this.sendService.sendMessage(envelope));

      // 5. Optimistic Save
      // Determine the Canonical Storage ID.
      // If we are chatting with a Contact, this ensures the message saves to the Contact thread.
      const storageUrn = await this.mapper.getStorageUrn(recipientUrn);

      const optimisticMsg: DecryptedMessage = {
        messageId: `local-${crypto.randomUUID()}`,
        senderId: myUrn,
        recipientId: recipientUrn, // Keep original input for reference
        sentTimestamp: payload.sentTimestamp,
        typeId: payload.typeId,
        payloadBytes: payload.payloadBytes,
        status: 'sent',
        conversationUrn: storageUrn, // <-- The Fix: Canonical ID via Mapper
      };

      await this.storageService.saveMessage(optimisticMsg);

      return optimisticMsg;
    } catch (error) {
      this.logger.error('Outbound: Failed to send message', error);
      return null;
    }
  }
} 