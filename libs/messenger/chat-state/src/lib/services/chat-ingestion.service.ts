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

  /**
   * Runs the ingestion pipeline.
   * Handles both Persistent (DB) and Ephemeral (Memory) message paths.
   */
  async process(
    myKeys: PrivateKeys,
    myUrn: URN,
    blockedSet: Set<string>,
    batchLimit = 50
  ): Promise<IngestionResult> {
    // 1. Fetch
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

        // 4. Gatekeeper: Block Check
        if (blockedSet.has(resolvedSenderStr)) {
          this.logger.info(
            `Dropped message from blocked identity: ${resolvedSenderStr}`
          );
          processedIds.push(msg.id);
          continue;
        }

        // 5. Gatekeeper: Pending Check
        if (resolvedSenderUrn.entityType !== 'user') {
          await this.contactsService.addToPending(resolvedSenderUrn);
          this.logger.info(`Added ${resolvedSenderStr} to pending list.`);
        }

        // --- FORK: Check Ephemeral Flag ---
        // If true, we consume the signal but DO NOT persist.
        if (msg.envelope.isEphemeral) {
          this.logger.debug(
            `Ingestion: Received typing indicator from ${resolvedSenderStr}`
          );
          typingIndicators.push(resolvedSenderUrn);
          processedIds.push(msg.id); // Ack it so we don't download it again
          continue; // SKIP Storage
        }

        // 6. Map & Save (Storage Model)
        const newDecryptedMsg = this.mapPayloadToDecrypted(
          msg,
          decrypted,
          resolvedSenderUrn,
          myUrn
        );

        await this.storageService.saveMessage(newDecryptedMsg);

        // 7. Convert to View Model
        validViewMessages.push(this.viewMapper.toView(newDecryptedMsg));
        processedIds.push(msg.id);
      } catch (error) {
        this.logger.error('Ingestion: Failed to process message', error, msg);
        processedIds.push(msg.id);
      }
    }

    // 8. Ack Batch
    if (processedIds.length > 0) {
      await firstValueFrom(this.dataService.acknowledge(processedIds));
    }

    // 9. Recursive Pull (if batch was full)
    if (queuedMessages.length === batchLimit) {
      this.logger.info('Ingestion: Queue full, triggering recursive pull.');
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

  private getConversationUrn(urn1: URN, urn2: URN, myUrn: URN): URN {
    return urn1.toString() === myUrn.toString() ? urn2 : urn1;
  }
}
