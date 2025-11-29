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

/**
 * Service responsible for pulling, decrypting, and processing incoming messages.
 * Acts as the "Ingestion Pipeline" that transforms raw encrypted server data
 * into verified, decrypted, and storage-ready local data.
 */
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
   * 1. Fetches a batch of pending messages.
   * 2. Decrypts and verifies signatures.
   * 3. RESOLVES IDENTITY (Handle -> Contact).
   * 4. Applies Gatekeeper logic (Blocked/Pending checks).
   * 5. Persists to local storage.
   * 6. Acknowledges receipt to server.
   *
   * @returns The array of NEW valid ChatMessages to update the UI state.
   */
  async process(
    myKeys: PrivateKeys,
    myUrn: URN,
    // REMOVED: identityMap is no longer needed; the Mapper handles resolution.
    blockedSet: Set<string>,
    batchLimit = 50
  ): Promise<ChatMessage[]> {
    // 1. Fetch
    const queuedMessages = await firstValueFrom(
      this.dataService.getMessageBatch(batchLimit)
    );

    if (queuedMessages.length === 0) return [];

    this.logger.info(
      `Ingestion: Processing ${queuedMessages.length} messages...`
    );

    const processedIds: string[] = [];
    const validViewMessages: ChatMessage[] = [];

    for (const msg of queuedMessages) {
      try {
        // 2. Decrypt
        // Result.senderId is the Network Handle (e.g. urn:lookup:email:bob@...)
        const decrypted = await this.cryptoService.verifyAndDecrypt(
          msg.envelope,
          myKeys
        );

        // 3. Identity Resolution (Handle -> Contact)
        // If this handle belongs to "Bob", this returns "urn:contacts:user:bob"
        const resolvedSenderUrn = await this.mapper.resolveToContact(
          decrypted.senderId
        );
        const resolvedSenderStr = resolvedSenderUrn.toString();

        // 4. Gatekeeper: Block Check (Check against Resolved Identity)
        if (blockedSet.has(resolvedSenderStr)) {
          this.logger.info(
            `Dropped message from blocked identity: ${resolvedSenderStr}`
          );
          processedIds.push(msg.id); // Ack to remove from queue
          continue;
        }

        // 5. Gatekeeper: Pending Check
        // If the resolved URN is still a Handle (meaning no Contact found),
        // we add it to the Waiting Room.
        if (resolvedSenderUrn.entityType !== 'user') {
          // Unknown -> Waiting Room
          await this.contactsService.addToPending(resolvedSenderUrn);
          this.logger.info(`Added ${resolvedSenderStr} to pending list.`);
        }

        // 6. Map & Save (Storage Model)
        // We save using the RESOLVED sender URN.
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
        // Ack failed messages so we don't loop forever on bad data
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
      return [...validViewMessages, ...nextBatch];
    }

    return validViewMessages;
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
      qMsg.envelope.recipientId, // This is me
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
   * Determines the canonical Conversation URN.
   * For 1:1 chats, the conversation ID is the ID of the *other* person.
   */
  private getConversationUrn(urn1: URN, urn2: URN, myUrn: URN): URN {
    return urn1.toString() === myUrn.toString() ? urn2 : urn1;
  }
}
