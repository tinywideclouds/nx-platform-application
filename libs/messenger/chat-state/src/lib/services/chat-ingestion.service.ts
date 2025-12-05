// libs/messenger/chat-state/src/lib/services/chat-ingestion.service.ts

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
import { ChatMessageMapper } from './chat-message.mapper';
import { ContactMessengerMapper } from './contact-messenger.mapper';

// Types
import { URN, QueuedMessage } from '@nx-platform-application/platform-types';
import {
  EncryptedMessagePayload,
  ChatMessage,
} from '@nx-platform-application/messenger-types';

export interface IngestionResult {
  messages: ChatMessage[];
  typingIndicators: URN[];
}

@Injectable({ providedIn: 'root' })
export class ChatIngestionService {
  private logger = inject(Logger);
  private dataService = inject(ChatDataService);
  private cryptoService = inject(MessengerCryptoService);
  private storageService = inject(ChatStorageService);
  private contactsService = inject(ContactsStorageService);
  private mapper = inject(ContactMessengerMapper);
  private viewMapper = inject(ChatMessageMapper);

  async process(
    myKeys: PrivateKeys,
    myUrn: URN,
    blockedSet: Set<string>,
    batchLimit = 50
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
        // 2. Decrypt
        const decrypted = await this.cryptoService.verifyAndDecrypt(
          msg.envelope,
          myKeys
        );

        // 3. Identity Resolution (Handle -> Contact)
        const resolvedSenderUrn = await this.mapper.resolveToContact(
          decrypted.senderId
        );
        const resolvedSenderStr = resolvedSenderUrn.toString();

        this.logger.debug(
          `Ingestion: Resolved ${decrypted.senderId} -> ${resolvedSenderStr}`
        );

        // 4. Gatekeeper: Block Check
        if (blockedSet.has(resolvedSenderStr)) {
          this.logger.info(
            `Dropped message from blocked identity: ${resolvedSenderStr}`
          );
          processedIds.push(msg.id);
          continue;
        }

        // --- FORK: Ephemeral (Typing Indicators) ---
        if (msg.envelope.isEphemeral) {
          typingIndicators.push(resolvedSenderUrn);
          processedIds.push(msg.id);
          continue;
        }

        // 5. Gatekeeper: Unknown User Check
        // If entityType is NOT 'user' (e.g., 'email' handle), it's a stranger.
        // Known contacts are resolved to 'urn:contacts:user:...' by the mapper.
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

          // A. Save to Quarantine Table (Hidden from Main UI)
          await this.storageService.saveQuarantinedMessage(newDecryptedMsg);

          // B. Add to Pending List
          await this.contactsService.addToPending(resolvedSenderUrn);

          // C. Ack network (we have it), but DO NOT add to validViewMessages
          processedIds.push(msg.id);
          continue;
        }

        // --- HAPPY PATH (Known Contact) ---
        await this.storageService.saveMessage(newDecryptedMsg);

        validViewMessages.push(this.viewMapper.toView(newDecryptedMsg));
        processedIds.push(msg.id);
      } catch (error) {
        this.logger.error('Ingestion: Failed to process message', error, msg);
        // Ack errors to prevent infinite loops, or use Dead Letter Queue logic here
        processedIds.push(msg.id);
      }
    }

    // 8. Ack Batch
    if (processedIds.length > 0) {
      await firstValueFrom(this.dataService.acknowledge(processedIds));
    }

    // 9. Recursive Pull
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

  /**
   * Determines the canonical Conversation ID.
   */
  private getConversationUrn(
    senderUrn: URN,
    recipientUrn: URN,
    myUrn: URN
  ): URN {
    // 1. Group Chat: The Conversation is the GROUP URN.
    if (recipientUrn.entityType === 'group') {
      return recipientUrn;
    }

    // 2. 1:1 Chat: The Conversation is the OTHER PERSON.
    // If I sent it, convo is Recipient.
    // If they sent it, convo is Sender.
    return senderUrn.toString() === myUrn.toString() ? recipientUrn : senderUrn;
  }
}
