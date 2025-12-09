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
  syncPayload?: EncryptedMessagePayload; // ✅ New field for Trojan Horse payload
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
    myKeys: PrivateKeys | null,
    myUrn: URN,
    blockedSet: Set<string>,
    batchLimit = 50,
    safeMode = false, // ✅ New Flag
    sessionPrivateKey: CryptoKey | null = null // ✅ New Key for Sync
  ): Promise<IngestionResult> {
    const queuedMessages = await firstValueFrom(
      this.dataService.getMessageBatch(batchLimit)
    );

    if (queuedMessages.length === 0) {
      return { messages: [], typingIndicators: [] };
    }

    this.logger.info(
      `Ingestion: Processing ${queuedMessages.length} messages... (SafeMode: ${safeMode})`
    );

    const processedIds: string[] = [];
    const validViewMessages: ChatMessage[] = [];
    const typingIndicators: URN[] = [];
    let foundSyncPayload: EncryptedMessagePayload | undefined;

    for (const msg of queuedMessages) {
      try {
        let decrypted: EncryptedMessagePayload;

        // --- Decryption Fork ---
        if (myKeys) {
          // Normal Operation
          decrypted = await this.cryptoService.verifyAndDecrypt(
            msg.envelope,
            myKeys
          );
        } else if (sessionPrivateKey && safeMode) {
          // Linking Operation
          // We only try to decrypt if we have the session key.
          try {
            decrypted = await this.cryptoService.decryptSyncMessage(
              msg.envelope,
              sessionPrivateKey
            );
          } catch (e) {
            // If this message wasn't encrypted for our session key, it will fail.
            // In Safe Mode, we just SKIP it (do not ack, do not log error as fatal).
            this.logger.debug(
              `Skipping unreadable message in Safe Mode: ${msg.id}`
            );
            continue;
          }
        } else {
          throw new Error('No keys available for decryption');
        }

        // --- Check for Device Sync ---
        // Note: We need to define this URN constant, using string literal for now
        if (decrypted.typeId.toString() === 'urn:message:type:device-sync') {
          this.logger.info('Ingestion: Received Device Sync Message!');
          foundSyncPayload = decrypted;
          processedIds.push(msg.id);
          continue; // Don't show in UI
        }

        // --- Normal Pipeline (Only if we have myKeys) ---
        // If we decrypted with SessionKey but it wasn't a sync message (unlikely but possible),
        // we shouldn't try to process it as a chat message.
        if (!myKeys) {
          continue;
        }

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

        // ✅ SAFE MODE: Do NOT Ack messages we failed to process
        if (safeMode) {
          this.logger.warn(
            `SafeMode: Skipping ACK for failed message ${msg.id}`
          );
          continue;
        }

        // Standard Mode: Ack to prevent infinite loops, or use Dead Letter Queue logic here
        processedIds.push(msg.id);
      }
    }

    // 8. Ack Batch
    if (processedIds.length > 0) {
      await firstValueFrom(this.dataService.acknowledge(processedIds));
    }

    // 9. Recursive Pull
    // In Safe Mode, we probably don't want to recurse infinitely if we are blocked.
    if (queuedMessages.length === batchLimit && !safeMode) {
      const nextBatch = await this.process(
        myKeys,
        myUrn,
        blockedSet,
        batchLimit,
        safeMode,
        sessionPrivateKey
      );
      return {
        messages: [...validViewMessages, ...nextBatch.messages],
        typingIndicators: [...typingIndicators, ...nextBatch.typingIndicators],
        syncPayload: foundSyncPayload || nextBatch.syncPayload,
      };
    }

    return {
      messages: validViewMessages,
      typingIndicators,
      syncPayload: foundSyncPayload,
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
