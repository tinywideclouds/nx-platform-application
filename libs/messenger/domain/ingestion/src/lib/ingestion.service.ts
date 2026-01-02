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
  MessageDeliveryStatus,
} from '@nx-platform-application/messenger-types';
import { ChatDataService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { Logger } from '@nx-platform-application/console-logger';
import {
  MessageContentParser,
  ReadReceiptData,
  MESSAGE_TYPE_READ_RECEIPT,
  MESSAGE_TYPE_TYPING,
} from '@nx-platform-application/messenger-domain-message-content';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';

export interface IngestionResult {
  messages: ChatMessage[];
  typingIndicators: URN[];
  readReceipts: string[];
}

@Injectable({ providedIn: 'root' })
export class IngestionService {
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

    if (!queue || queue.length === 0) {
      return result;
    }

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

    if (queue.length === batchSize) {
      const nextBatch = await this.process(
        myKeys,
        myUrn,
        blockedSet,
        batchSize,
      );
      return {
        messages: [...result.messages, ...nextBatch.messages],
        typingIndicators: [
          ...result.typingIndicators,
          ...nextBatch.typingIndicators,
        ],
        readReceipts: [...result.readReceipts, ...nextBatch.readReceipts],
      };
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

    const canonicalSenderUrn = await this.quarantineService.process(
      transport,
      blockedSet,
    );

    if (!canonicalSenderUrn) {
      return;
    }

    await this.parseAndStore(
      transport,
      item.id,
      canonicalSenderUrn,
      accumulator,
    );
  }

  private async parseAndStore(
    transport: TransportMessage,
    queueId: string,
    canonicalSenderUrn: URN,
    accumulator: IngestionResult,
  ): Promise<void> {
    const typeStr = transport.typeId.toString();
    const parsed = this.parser.parse(transport.typeId, transport.payloadBytes);
    const canonicalId = transport.clientRecordId || queueId;

    switch (parsed.kind) {
      case 'content': {
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
          conversationUrn: conversationUrn,
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
        if (typeStr === MESSAGE_TYPE_TYPING) {
          accumulator.typingIndicators.push(transport.senderId);
        } else if (typeStr === MESSAGE_TYPE_READ_RECEIPT) {
          const rr = parsed.payload.data as ReadReceiptData;
          const ids = rr?.messageIds || [];

          if (ids.length > 0) {
            this.logger.info(
              `[Ingestion] Applying Read Receipt for ${ids.length} msgs`,
            );

            const newStatus: MessageDeliveryStatus = 'read';
            await this.storageService.updateMessageStatus(ids, newStatus);

            accumulator.readReceipts.push(...ids);
          }
        }
        break;
      }
    }
  }
}
