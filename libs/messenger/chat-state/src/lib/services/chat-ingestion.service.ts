import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';

// Services
import { ChatDataService } from '@nx-platform-application/chat-access';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-bridge';
import {
  ChatStorageService,
  DecryptedMessage,
} from '@nx-platform-application/chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';

// Adapters & Mappers
import { ChatMessageMapper } from './chat-message.mapper';
// [Refactor] We now inject the abstract contract, not the concrete implementation
import { IdentityResolver } from '@nx-platform-application/messenger-identity-adapter';

// Types
import { URN, QueuedMessage } from '@nx-platform-application/platform-types';
import {
  EncryptedMessagePayload,
  ChatMessage,
} from '@nx-platform-application/messenger-types';

export interface IngestionResult {
  messages: ChatMessage[];
  typingIndicators: URN[];
  // [Removed] syncPayload - Device Pairing is now handled by the 'Ceremony' lib
}

@Injectable({ providedIn: 'root' })
export class ChatIngestionService {
  private logger = inject(Logger);
  private dataService = inject(ChatDataService);
  private cryptoService = inject(MessengerCryptoService);
  private storageService = inject(ChatStorageService);
  private contactsService = inject(ContactsStorageService);

  // [Refactor] Swapped for the clean interface
  private identityResolver = inject(IdentityResolver);
  private viewMapper = inject(ChatMessageMapper);

  /**
   * Processes the inbound message queue.
   * STRICT: Requires valid Identity Keys.
   */
  async process(
    myKeys: PrivateKeys, // [Refactor] No longer nullable. Must be authenticated.
    myUrn: URN,
    blockedSet: Set<string>,
    batchLimit = 50
    // [Removed] safeMode
    // [Removed] sessionPrivateKey
  ): Promise<IngestionResult> {
    const queuedMessages = await firstValueFrom(
      this.dataService.getMessageBatch(batchLimit)
    );

    if (queuedMessages.length === 0) {
      return { messages: [], typingIndicators: [] };
    }

    this.logger.info(
      `Ingestion: Processing ${queuedMessages.length} messages...`
    );

    const processedIds: string[] = [];
    const validViewMessages: ChatMessage[] = [];
    const typingIndicators: URN[] = [];

    for (const msg of queuedMessages) {
      try {
        // 1. Decrypt (Standard Path Only)
        // We only support Identity Keys here. Handshakes happen in DevicePairingService.
        const decrypted: EncryptedMessagePayload =
          await this.cryptoService.verifyAndDecrypt(msg.envelope, myKeys);

        // [Removed] 'urn:message:type:device-sync' check.
        // If a sync message arrives here, it's treated as an unsupported message type
        // or filtered out by the UI, but it doesn't trigger logic.

        // 2. Identity Resolution (Handle -> Contact)
        // Uses the new Adapter
        const resolvedSenderUrn = await this.identityResolver.resolveToContact(
          decrypted.senderId
        );
        const resolvedSenderStr = resolvedSenderUrn.toString();

        this.logger.debug(
          `Ingestion: Resolved ${decrypted.senderId} -> ${resolvedSenderStr}`
        );

        // 3. Gatekeeper: Block Check
        if (blockedSet.has(resolvedSenderStr)) {
          this.logger.info(
            `Dropped message from blocked identity: ${resolvedSenderStr}`
          );
          processedIds.push(msg.id);
          continue;
        }

        // 4. Ephemeral Check (Typing Indicators)
        if (msg.envelope.isEphemeral) {
          typingIndicators.push(resolvedSenderUrn);
          processedIds.push(msg.id);
          continue;
        }

        // 5. Gatekeeper: Unknown User Check
        const isStranger = resolvedSenderUrn.entityType !== 'user';

        const newDecryptedMsg = this.mapPayloadToDecrypted(
          msg,
          decrypted,
          resolvedSenderUrn,
          myUrn
        );

        if (isStranger) {
          // --- QUARANTINE PATH ---
          this.logger.info(
            `Quarantining message from stranger: ${resolvedSenderStr}`
          );

          await this.storageService.saveQuarantinedMessage(newDecryptedMsg);
          await this.contactsService.addToPending(resolvedSenderUrn);

          processedIds.push(msg.id);
          continue;
        }

        // --- HAPPY PATH (Known Contact) ---
        await this.storageService.saveMessage(newDecryptedMsg);

        validViewMessages.push(this.viewMapper.toView(newDecryptedMsg));
        processedIds.push(msg.id);
      } catch (error) {
        this.logger.error('Ingestion: Failed to process message', error, msg);
        // We ack failed messages to prevent infinite loops (Dead Letter strategy)
        processedIds.push(msg.id);
      }
    }

    // 6. Ack Batch
    if (processedIds.length > 0) {
      await firstValueFrom(this.dataService.acknowledge(processedIds));
    }

    // 7. Recursive Pull
    if (queuedMessages.length === batchLimit) {
      const nextBatch = await this.process(
        myKeys,
        myUrn,
        blockedSet,
        batchLimit
      );
      return {
        messages: [...validViewMessages, ...nextBatch.messages],
        typingIndicators: [...typingIndicators, ...nextBatch.typingIndicators],
      };
    }

    return {
      messages: validViewMessages,
      typingIndicators,
    };
  }

  // --- Internal Mapper ---

  private mapPayloadToDecrypted(
    qMsg: QueuedMessage,
    payload: EncryptedMessagePayload,
    resolvedSenderUrn: URN,
    myUrn: URN
  ): DecryptedMessage {
    const conversationUrn = this.getConversationUrn(
      resolvedSenderUrn,
      qMsg.envelope.recipientId,
      myUrn
    );

    return {
      messageId: qMsg.id,
      senderId: resolvedSenderUrn,
      recipientId: qMsg.envelope.recipientId,
      sentTimestamp: payload.sentTimestamp,
      typeId: payload.typeId,
      payloadBytes: payload.payloadBytes,
      status: 'received',
      conversationUrn: conversationUrn,
    };
  }

  private getConversationUrn(
    senderUrn: URN,
    recipientUrn: URN,
    myUrn: URN
  ): URN {
    if (recipientUrn.entityType === 'group') {
      return recipientUrn;
    }
    return senderUrn.toString() === myUrn.toString() ? recipientUrn : senderUrn;
  }
}
