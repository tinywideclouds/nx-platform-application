// libs/messenger/chat-state/src/lib/services/chat-outbound.service.ts

import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';
import { Temporal } from '@js-temporal/polyfill';

// Services
import { ChatSendService } from '@nx-platform-application/chat-data-access';
import { MessengerCryptoService, PrivateKeys } from '@nx-platform-application/messenger-crypto-access';
import { ChatStorageService, DecryptedMessage } from '@nx-platform-application/chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-data-access';
import { KeyCacheService } from '@nx-platform-application/key-cache-access';

// Types
import { URN, ISODateTimeString } from '@nx-platform-application/platform-types';
import { EncryptedMessagePayload } from '@nx-platform-application/messenger-types';

@Injectable({ providedIn: 'root' })
export class ChatOutboundService {
  private logger = inject(Logger);
  private sendService = inject(ChatSendService);
  private cryptoService = inject(MessengerCryptoService);
  private storageService = inject(ChatStorageService);
  private contactsService = inject(ContactsStorageService);
  private keyService = inject(KeyCacheService);

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
      // 1. Resolve Recipient (Contact -> Auth)
      const targetAuthUrn = await this.resolveRecipientIdentity(recipientUrn);

      // 2. Construct Payload
      const payload: EncryptedMessagePayload = {
        senderId: myUrn,
        sentTimestamp: Temporal.Now.instant().toString() as ISODateTimeString,
        typeId: typeId,
        payloadBytes: payloadBytes,
      };

      // 3. Fetch Keys & Encrypt
      const recipientKeys = await this.keyService.getPublicKey(targetAuthUrn);
      const envelope = await this.cryptoService.encryptAndSign(
        payload,
        targetAuthUrn,
        myKeys,
        recipientKeys
      );

      // 4. Network Send
      await firstValueFrom(this.sendService.sendMessage(envelope));

      // 5. Optimistic Save (Storage Model)
      // Note: We store the ORIGINAL recipientUrn (Contact) for conversation grouping,
      // even though we encrypted for targetAuthUrn.
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

  /**
   * Resolves a Contact URN to a specific Authentication URN for encryption.
   */
  private async resolveRecipientIdentity(recipientUrn: URN): Promise<URN> {
    if (recipientUrn.toString().startsWith('urn:auth:')) {
      return recipientUrn;
    }
    // If it's a Contact, get linked identities
    const identities = await this.contactsService.getLinkedIdentities(recipientUrn);
    
    // TODO: Add logic to pick the "active" or "primary" identity.
    // For now, pick the first one.
    if (identities.length > 0) {
      return identities[0];
    }
    
    // Fallback: Assume the URN is usable as-is (legacy/testing)
    return recipientUrn;
  }

  private getConversationUrn(urn1: URN, urn2: URN, myUrn: URN): URN {
    // Logic: If urn1 is me, conversation is urn2.
    return urn1.toString() === myUrn.toString() ? urn2 : urn1;
  }
}