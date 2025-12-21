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
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';

// Adapters & Logic
import { ChatMessageMapper } from './chat-message.mapper';
import { IdentityResolver } from '@nx-platform-application/messenger-identity-adapter';
import {
  MessageContentParser,
  ReadReceiptData,
} from '@nx-platform-application/message-content';

// Types
import { URN, QueuedMessage } from '@nx-platform-application/platform-types';
import {
  EncryptedMessagePayload,
  ChatMessage,
  DecryptedMessage,
} from '@nx-platform-application/messenger-types';

export interface IngestionResult {
  messages: ChatMessage[];
  typingIndicators: URN[];
  readReceipts: string[];
}

@Injectable({ providedIn: 'root' })
export class ChatIngestionService {
  private logger = inject(Logger);
  private dataService = inject(ChatDataService);
  private cryptoService = inject(MessengerCryptoService);
  private storageService = inject(ChatStorageService);
  private contactsService = inject(ContactsStorageService);
  private identityResolver = inject(IdentityResolver);
  private viewMapper = inject(ChatMessageMapper);
  private parser = inject(MessageContentParser);

  async process(
    myKeys: PrivateKeys,
    myUrn: URN,
    blockedSet: Set<string>,
    batchLimit = 50,
  ): Promise<IngestionResult> {
    const queuedMessages = await firstValueFrom(
      this.dataService.getMessageBatch(batchLimit),
    );

    if (queuedMessages.length === 0) {
      return { messages: [], typingIndicators: [], readReceipts: [] };
    }

    const processedIds: string[] = [];
    const validViewMessages: ChatMessage[] = [];
    const typingIndicators: URN[] = [];
    const readReceipts: string[] = [];

    for (const msg of queuedMessages) {
      try {
        // 1. Decrypt
        const decrypted: EncryptedMessagePayload =
          await this.cryptoService.verifyAndDecrypt(msg.envelope, myKeys);

        // 2. Identity Resolution
        const resolvedSenderUrn = await this.identityResolver.resolveToContact(
          decrypted.senderId,
        );
        const resolvedSenderStr = resolvedSenderUrn.toString();

        // 3. Block Check
        if (blockedSet.has(resolvedSenderStr)) {
          processedIds.push(msg.id);
          continue;
        }

        // 4. Parse Payload
        const classification = this.parser.parse(
          decrypted.typeId,
          decrypted.payloadBytes,
        );

        // --- PATH A: SIGNALS ---
        if (classification.kind === 'signal') {
          const action = classification.payload.action;
          const data = classification.payload.data;

          if (action === 'read-receipt') {
            const rr = data as ReadReceiptData;
            this.logger.info(
              `[Ingestion] Processing Read Receipt for ${rr.messageIds.length} msgs`,
            );
            await this.storageService.updateMessageStatus(
              rr.messageIds,
              'read',
            );
            readReceipts.push(...rr.messageIds);
          } else if (action === 'typing') {
            typingIndicators.push(resolvedSenderUrn);
          }

          processedIds.push(msg.id);
          continue;
        }

        // --- PATH B: UNKNOWN ---
        if (classification.kind === 'unknown') {
          this.logger.warn(
            `[Ingestion] Dropping unknown type: ${classification.rawType}`,
          );
          processedIds.push(msg.id);
          continue;
        }

        // --- PATH C: CONTENT ---
        const isStranger = resolvedSenderUrn.entityType !== 'user';
        const newDecryptedMsg = this.mapPayloadToDecrypted(
          msg,
          decrypted,
          resolvedSenderUrn,
          myUrn,
        );

        if (isStranger) {
          await this.storageService.saveQuarantinedMessage(newDecryptedMsg);
          await this.contactsService.addToPending(resolvedSenderUrn);
        } else {
          // ✅ SIMPLIFIED: No "Promotion" needed.
          // Because mapPayloadToDecrypted (below) now prefers the Sender's ID,
          // Echos are automatically detected as "Duplicates" of the Pending Message
          // and handled idempotently by saveMessage().

          const wasSaved =
            await this.storageService.saveMessage(newDecryptedMsg);

          if (wasSaved) {
            validViewMessages.push(this.viewMapper.toView(newDecryptedMsg));
          } else {
            // Idempotency Logging
            if (resolvedSenderStr === myUrn.toString()) {
              this.logger.debug(
                `[Ingestion] Echo received (idempotent): ${newDecryptedMsg.messageId}`,
              );
            } else {
              this.logger.warn(
                `[Ingestion] Duplicate message detected: ${newDecryptedMsg.messageId}. Acking.`,
              );
            }
          }
        }

        processedIds.push(msg.id);
      } catch (error) {
        this.logger.error('Ingestion: Failed to process message', error);
        processedIds.push(msg.id);
      }
    }

    if (processedIds.length > 0) {
      await firstValueFrom(this.dataService.acknowledge(processedIds));
    }

    if (queuedMessages.length === batchLimit) {
      const nextBatch = await this.process(
        myKeys,
        myUrn,
        blockedSet,
        batchLimit,
      );
      return {
        messages: [...validViewMessages, ...nextBatch.messages],
        typingIndicators: [...typingIndicators, ...nextBatch.typingIndicators],
        readReceipts: [...readReceipts, ...nextBatch.readReceipts],
      };
    }

    return {
      messages: validViewMessages,
      typingIndicators,
      readReceipts,
    };
  }

  // ✅ CRITICAL FIX: Prefer Sender Authority (clientRecordId)
  private mapPayloadToDecrypted(
    qMsg: QueuedMessage,
    payload: EncryptedMessagePayload,
    resolvedSenderUrn: URN,
    myUrn: URN,
  ): DecryptedMessage {
    const conversationUrn = this.getConversationUrn(
      resolvedSenderUrn,
      qMsg.envelope.recipientId,
      myUrn,
    );

    // THE FIX: If the Sender provided an ID, use it. Otherwise, use Router ID.
    const canonicalId = payload.clientRecordId || qMsg.id;

    return {
      messageId: canonicalId,
      senderId: resolvedSenderUrn,
      recipientId: qMsg.envelope.recipientId,
      sentTimestamp: payload.sentTimestamp,
      typeId: payload.typeId,
      payloadBytes: payload.payloadBytes,
      status: 'received',
      conversationUrn: conversationUrn,
    };
  }

  private getConversationUrn(sender: URN, recipient: URN, me: URN): URN {
    if (recipient.entityType === 'group') return recipient;
    return sender.toString() === me.toString() ? recipient : sender;
  }
}
