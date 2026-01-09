// libs/messenger/domain/ingestion/src/lib/ingestion.service.ts

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
import { ChatDataService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { GroupNetworkStorageApi } from '@nx-platform-application/contacts-api';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { Logger } from '@nx-platform-application/console-logger';
import {
  MessageContentParser,
  ReadReceiptData,
  AssetRevealData, // ✅ Import
  MESSAGE_TYPE_TYPING,
  MESSAGE_TYPE_READ_RECEIPT,
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
  private groupStorage = inject(GroupNetworkStorageApi);
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

    // 1. SECURITY CHECK: Quarantine Gatekeeper
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

        if (parsed.payload.kind === 'group-system') {
          const data = parsed.payload.data;
          try {
            const groupUrn = URN.parse(data.groupUrn);

            if (data.status === 'joined') {
              this.logger.info(
                `[Ingestion] Roster Update: ${canonicalSenderUrn} joined ${groupUrn}`,
              );
              await this.groupStorage.updateGroupMemberStatus(
                groupUrn,
                canonicalSenderUrn,
                'joined',
              );
            } else if (data.status === 'declined') {
              this.logger.info(
                `[Ingestion] Roster Update: ${canonicalSenderUrn} declined ${groupUrn}`,
              );
              await this.groupStorage.updateGroupMemberStatus(
                groupUrn,
                canonicalSenderUrn,
                'declined',
              );
            }
          } catch (e) {
            this.logger.error('[Ingestion] Failed to update group roster', e);
          }
        }

        const chatMessage: ChatMessage = {
          id: canonicalId,
          senderId: canonicalSenderUrn,
          sentTimestamp: transport.sentTimestamp as ISODateTimeString,
          typeId: transport.typeId,
          status: 'received',
          conversationUrn: conversationUrn!, // (! assertion safe via Guard logic)
          tags: parsed.tags,
          payloadBytes: this.parser.serialize(parsed.payload),
          textContent:
            parsed.payload.kind === 'text' ? parsed.payload.text : undefined,
        };

        await this.storageService.saveMessage(chatMessage);
        accumulator.messages.push(chatMessage);
        break;
      }

      case 'signal': {
        const payload = parsed.payload;

        if (payload.action === 'read-receipt') {
          const rr = payload.data as ReadReceiptData;
          const ids = rr?.messageIds || [];

          if (ids.length > 0) {
            this.logger.info(
              `[Ingestion] Applying Read Receipt from ${canonicalSenderUrn}`,
            );

            for (const msgId of ids) {
              await this.storageService.applyReceipt(
                msgId,
                canonicalSenderUrn,
                'read',
              );
            }
            accumulator.readReceipts.push(...ids);
          }
        } else if (typeStr === MESSAGE_TYPE_TYPING) {
          accumulator.typingIndicators.push(canonicalSenderUrn);
        }
        // ✅ NEW: Asset Reveal (Smart Patching)
        else if (payload.action === 'asset-reveal') {
          const patch = payload.data as AssetRevealData;
          await this.handleAssetReveal(patch);
        }
        break;
      }
    }
  }

  /**
   * Domain Logic: Read -> Parse -> Patch -> Serialize -> Write
   */
  private async handleAssetReveal(patch: AssetRevealData): Promise<void> {
    const msg = await this.storageService.getMessage(patch.messageId);
    if (!msg) return;

    try {
      if (!msg.payloadBytes) {
        this.logger.warn(
          `[Ingestion] Cannot patch ${patch.messageId}: Missing payload bytes`,
        );
        return;
      }
      // 1. Parse Existing
      const parsed = this.parser.parse(msg.typeId, msg.payloadBytes);
      if (parsed.kind !== 'content') return;

      // 2. Patch
      const newPayload = { ...parsed.payload, remoteUrl: patch.remoteUrl };

      // 3. Serialize
      const newBytes = this.parser.serialize(newPayload);

      // 4. Save Raw Bytes
      await this.storageService.updateMessagePayload(patch.messageId, newBytes);

      this.logger.info(`[Ingestion] Patched remoteUrl for ${patch.messageId}`);
    } catch (e) {
      this.logger.error(
        `[Ingestion] Failed to patch message ${patch.messageId}`,
        e,
      );
    }
  }
}
