// libs/messenger/chat-state/src/lib/services/chat-outbound.service.ts

import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';
import { Temporal } from '@js-temporal/polyfill';

// Services
import { ChatSendService } from '@nx-platform-application/chat-access';
import { MessengerCryptoService, PrivateKeys } from '@nx-platform-application/messenger-crypto-access';
import { ChatStorageService, DecryptedMessage } from '@nx-platform-application/chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { ChatKeyService } from './chat-key.service'; // <--- NEW IMPORT

// Types
import { URN, ISODateTimeString } from '@nx-platform-application/platform-types';
import { EncryptedMessagePayload } from '@nx-platform-application/messenger-types';

@Injectable({ providedIn: 'root' })
export class ChatOutboundService {
  private logger = inject(Logger);
  private sendService = inject(ChatSendService);
  private cryptoService = inject(MessengerCryptoService);
  private storageService = inject(ChatStorageService);
  private keyCache = inject(KeyCacheService); // Renamed from keyService to avoid confusion
  private keyLogic = inject(ChatKeyService); // <--- NEW INJECTION

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
      // 1. Resolve Recipient (Contact -> Auth/Lookup)
      // We use the shared logic that includes Email Discovery.
      const targetAuthUrn = await this.keyLogic.resolveRecipientIdentity(recipientUrn);

      // 2. Construct Payload
      const payload: EncryptedMessagePayload = {
        senderId: myUrn,
        sentTimestamp: Temporal.Now.instant().toString() as ISODateTimeString,
        typeId: typeId,
        payloadBytes: payloadBytes,
      };

      // 3. Fetch Keys & Encrypt
      // Now we are querying keys for 'urn:lookup:email:bob@...' which exists!
      const recipientKeys = await this.keyCache.getPublicKey(targetAuthUrn);
      const envelope = await this.cryptoService.encryptAndSign(
        payload,
        targetAuthUrn,
        myKeys,
        recipientKeys
      );

      // 4. Network Send
      await firstValueFrom(this.sendService.sendMessage(envelope));

      // 5. Optimistic Save
      // We store the ORIGINAL recipientUrn (Contact) for conversation grouping.
      const optimisticMsg: DecryptedMessage = {
        messageId: `local-${crypto.randomUUID()}`,
        senderId: myUrn,
        recipientId: recipientUrn,
        sentTimestamp: payload.sentTimestamp,
        typeId: payload.typeId,
        payloadBytes: payload.payloadBytes,
        status: 'sent',
        conversationUrn: this.getConversationUrn(myUrn, recipientUrn, myUrn),
      };

      await this.storageService.saveMessage(optimisticMsg);

      return optimisticMsg;
    } catch (error) {
      this.logger.error('Outbound: Failed to send message', error);
      return null;
    }
  }

  private getConversationUrn(urn1: URN, urn2: URN, myUrn: URN): URN {
    return urn1.toString() === myUrn.toString() ? urn2 : urn1;
  }
}