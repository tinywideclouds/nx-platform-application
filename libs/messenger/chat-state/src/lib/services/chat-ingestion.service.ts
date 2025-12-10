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

// Adapters & Logic
import { ChatMessageMapper } from './chat-message.mapper';
import { IdentityResolver } from '@nx-platform-application/messenger-identity-adapter';
// REFACTOR: Import the Parser and Types
import {
  MessageContentParser,
  ReadReceiptData,
} from '@nx-platform-application/message-content';

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
  private identityResolver = inject(IdentityResolver);
  private viewMapper = inject(ChatMessageMapper);

  // REFACTOR: The Router Logic
  private parser = inject(MessageContentParser);

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

    const processedIds: string[] = [];
    const validViewMessages: ChatMessage[] = [];
    const typingIndicators: URN[] = [];

    for (const msg of queuedMessages) {
      try {
        // 1. Decrypt
        const decrypted: EncryptedMessagePayload =
          await this.cryptoService.verifyAndDecrypt(msg.envelope, myKeys);

        // 2. Identity Resolution
        const resolvedSenderUrn = await this.identityResolver.resolveToContact(
          decrypted.senderId
        );
        const resolvedSenderStr = resolvedSenderUrn.toString();

        // 3. Gatekeeper: Block Check
        if (blockedSet.has(resolvedSenderStr)) {
          processedIds.push(msg.id);
          continue;
        }

        // 4. Ephemeral Check (Transport Layer Signal)
        // Currently hardcoded to "Typing Indicator"
        if (msg.envelope.isEphemeral) {
          typingIndicators.push(resolvedSenderUrn);
          processedIds.push(msg.id);
          continue;
        }

        // 5. REFACTOR: PAYLOAD ROUTING (Application Layer Signal)
        // We look inside the box to see what it is.
        const classification = this.parser.parse(
          decrypted.typeId,
          decrypted.payloadBytes
        );

        // --- PATH A: SIGNALS (Do Not Save) ---
        if (classification.kind === 'signal') {
          const action = classification.payload.action;
          const data = classification.payload.data;

          this.logger.info(`[Router] Received Signal: ${action}`);

          if (action === 'read-receipt') {
            const rr = data as ReadReceiptData;
            // ACTION: Mark my sent messages as read
            await this.storageService.updateMessageStatus(
              rr.messageIds,
              'read'
            );
          }

          processedIds.push(msg.id);
          continue;
        }

        // --- PATH B: UNKNOWN (Drop) ---
        if (classification.kind === 'unknown') {
          this.logger.warn(
            `[Router] Dropping unknown type: ${classification.rawType}`
          );
          processedIds.push(msg.id);
          continue;
        }

        // --- PATH C: CONTENT (Save to DB) ---
        // classification.kind === 'content'

        const isStranger = resolvedSenderUrn.entityType !== 'user';

        const newDecryptedMsg = this.mapPayloadToDecrypted(
          msg,
          decrypted,
          resolvedSenderUrn,
          myUrn
        );

        if (isStranger) {
          await this.storageService.saveQuarantinedMessage(newDecryptedMsg);
          await this.contactsService.addToPending(resolvedSenderUrn);
        } else {
          await this.storageService.saveMessage(newDecryptedMsg);
          validViewMessages.push(this.viewMapper.toView(newDecryptedMsg));
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

  // ... [Helpers: mapPayloadToDecrypted, getConversationUrn remain unchanged] ...
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

  private getConversationUrn(sender: URN, recipient: URN, me: URN): URN {
    if (recipient.entityType === 'group') return recipient;
    return sender.toString() === me.toString() ? recipient : sender;
  }
}
