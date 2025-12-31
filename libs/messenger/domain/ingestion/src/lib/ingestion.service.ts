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
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { Logger } from '@nx-platform-application/console-logger';
import { MessageContentParser } from '@nx-platform-application/message-content';
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

  /**
   * The "Airlock" Process.
   * Pulls encrypted blobs, verifies them, checks admission, and only THEN parses content.
   */
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

    // 1. Fetch Encrypted Blobs (The "Courtyard")
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
        // We still ack failed messages to prevent queue blocking (Dead Letter Logic)
        processedIds.push(item.id);
      }
    }

    // Acknowledge receipt to clear queue
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
    // 2. Decrypt & Verify Signature (The "Lock")
    // If this fails, it throws, and we skip the message.
    const transport: TransportMessage =
      await this.cryptoService.verifyAndDecrypt(item.envelope, myKeys);

    // 3. Quarantine Check (The "Guard")
    // Returns Canonical URN if allowed, null if jailed/blocked.
    const canonicalSenderUrn = await this.quarantineService.process(
      transport,
      blockedSet,
    );

    // If null, the guard said "No". We stop here.
    // The message is already in the Quarantine DB (if needed) or dropped.
    if (!canonicalSenderUrn) return;

    // 4. Parse Content (The "Lab")
    // Only reachable by trusted entities.
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
