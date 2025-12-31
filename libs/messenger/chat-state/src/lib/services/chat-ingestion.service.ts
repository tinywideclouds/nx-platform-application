import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  URN,
  QueuedMessage,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  TransportMessage,
} from '@nx-platform-application/messenger-types';
import { ChatDataService } from '@nx-platform-application/chat-access';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { Logger } from '@nx-platform-application/console-logger';
import { MessageContentParser } from '@nx-platform-application/message-content';
import { QuarantineService } from '@nx-platform-application/messenger-quarantine';

export interface IngestionResult {
  messages: ChatMessage[];
  typingIndicators: URN[];
  readReceipts: string[];
}

@Injectable({ providedIn: 'root' })
export class ChatIngestionService {
  private dataService = inject(ChatDataService);
  private cryptoService = inject(MessengerCryptoService);
  private storageService = inject(ChatStorageService);
  private quarantineService = inject(QuarantineService);
  private parser = inject(MessageContentParser);
  private logger = inject(Logger);

  async process(
    myKeys: PrivateKeys,
    myUrn: URN,
    blockedSet: Set<string>,
    batchSize = 50,
  ): Promise<IngestionResult> {
    const result: IngestionResult = {
      messages: [],
      typingIndicators: [],
      readReceipts: [],
    };

    const queue = await firstValueFrom(
      this.dataService.getMessageBatch(batchSize),
    );

    if (!queue || queue.length === 0) return result;

    const processedIds: string[] = [];

    for (const item of queue) {
      try {
        await this.processSingleMessage(item, myKeys, blockedSet, result);
        processedIds.push(item.id);
      } catch (error) {
        this.logger.error(
          `[Ingestion] Failed to process msg ${item.id}`,
          error,
        );
        processedIds.push(item.id);
      }
    }

    if (processedIds.length > 0) {
      await firstValueFrom(this.dataService.acknowledge(processedIds));
    }

    return result;
  }

  private async processSingleMessage(
    item: QueuedMessage,
    myKeys: PrivateKeys,
    blockedSet: Set<string>,
    accumulator: IngestionResult,
  ): Promise<void> {
    const transport: TransportMessage =
      await this.cryptoService.verifyAndDecrypt(item.envelope, myKeys);

    // 1. Gatekeeper & Resolution (Combined Step)
    // Returns the Canonical URN if allowed, null if blocked.
    const canonicalSenderUrn = await this.quarantineService.process(
      transport,
      blockedSet,
    );

    if (!canonicalSenderUrn) return;

    // 2. Promote (Using the already-resolved identity)
    await this.promoteToDomain(
      transport,
      item.id,
      canonicalSenderUrn, // ✅ Passed forward
      accumulator,
    );
  }

  private async promoteToDomain(
    transport: TransportMessage,
    queueId: string,
    canonicalSenderUrn: URN, // ✅ Used for conversation ID (1:1 logic)
    accumulator: IngestionResult,
  ): Promise<void> {
    const parsed = this.parser.parse(transport.typeId, transport.payloadBytes);
    const canonicalId = transport.clientRecordId || queueId;

    switch (parsed.kind) {
      case 'content': {
        // LOGIC: For 1:1 chats, the Conversation URN IS the Sender's Canonical URN.
        // For Groups, it would be the Group ID (parsed.conversationId).
        // Since we are fixing the "Contact vs Handle" issue, we prioritize the Canonical ID.
        const conversationUrn =
          parsed.conversationId.entityType === 'group'
            ? parsed.conversationId
            : canonicalSenderUrn;

        const chatMessage: ChatMessage = {
          id: canonicalId,
          senderId: transport.senderId,
          sentTimestamp: transport.sentTimestamp as ISODateTimeString,
          typeId: transport.typeId,
          status: 'received',
          conversationUrn: conversationUrn, // ✅ Correct UUID used here
          tags: parsed.tags,
          payloadBytes:
            parsed.payload.kind === 'text'
              ? new TextEncoder().encode(parsed.payload.text)
              : new TextEncoder().encode(JSON.stringify(parsed.payload.data)),
          textContent:
            parsed.payload.kind === 'text' ? parsed.payload.text : undefined,
        };

        await this.storageService.saveMessage(chatMessage);
        accumulator.messages.push(chatMessage);
        break;
      }

      case 'signal': {
        if (parsed.payload.action === 'typing') {
          accumulator.typingIndicators.push(transport.senderId);
        } else if (parsed.payload.action === 'read_receipt') {
          const ids = (parsed.payload.data as any)?.messageIds || [];
          accumulator.readReceipts.push(...ids);
        }
        break;
      }
    }
  }
}
