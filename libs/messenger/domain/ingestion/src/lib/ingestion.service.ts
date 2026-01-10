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
  AssetRevealData,
  MessageTypingIndicator,
} from '@nx-platform-application/messenger-domain-message-content';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';

export interface IngestionResult {
  messages: ChatMessage[];
  typingIndicators: URN[];
  readReceipts: string[];
  patchedMessageIds: string[];
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
      patchedMessageIds: [],
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
        patchedMessageIds: [
          ...result.patchedMessageIds,
          ...nextBatch.patchedMessageIds,
        ],
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

    await this.routeAndProcess(
      transport,
      item.id,
      canonicalSenderUrn,
      accumulator,
    );
  }

  // ✅ REFACTOR: Clean, Type-Safe Routing
  private async routeAndProcess(
    transport: TransportMessage,
    queueId: string,
    canonicalSenderUrn: URN,
    accumulator: IngestionResult,
  ): Promise<void> {
    // 1. INTENT: Check Transport URN properties
    const typeId = transport.typeId;
    const isSignal =
      typeId.namespace === 'message' && typeId.entityType === 'signal';

    // 2. PARSE: Extract data
    const parsed = this.parser.parse(typeId, transport.payloadBytes);

    // 3. ROUTE: Signal Path (High Priority)
    // Strictly guards against saving "Ghost Messages" to the DB.
    if (isSignal) {
      if (parsed.kind === 'signal') {
        await this.handleSignal(
          parsed.payload,
          canonicalSenderUrn,
          accumulator,
        );
      } else {
        this.logger.warn(
          `[Ingestion] Signal Mismatch: Transport=Signal, Parser=${parsed.kind}`,
        );
      }
      return;
    }

    // 4. ROUTE: Content Path
    // Only reachable if Transport says "Not a Signal".
    if (parsed.kind === 'content') {
      await this.handleContent(
        parsed,
        transport,
        queueId,
        canonicalSenderUrn,
        accumulator,
      );
      return;
    }

    // 5. DEAD END: Unrecognized
    this.logger.warn(
      `[Ingestion] Dropped Unhandled: Transport=${typeId.toString()}, Parser=${
        parsed.kind
      }`,
    );
  }

  private async handleContent(
    parsed: any,
    transport: TransportMessage,
    queueId: string,
    canonicalSenderUrn: URN,
    accumulator: IngestionResult,
  ): Promise<void> {
    const canonicalId = transport.clientRecordId || queueId;
    const conversationUrn =
      parsed.conversationId.entityType === 'group'
        ? parsed.conversationId
        : canonicalSenderUrn;

    if (parsed.payload.kind === 'group-system') {
      const data = parsed.payload.data;
      try {
        const groupUrn = URN.parse(data.groupUrn);
        if (data.status === 'joined') {
          await this.groupStorage.updateGroupMemberStatus(
            groupUrn,
            canonicalSenderUrn,
            'joined',
          );
        } else if (data.status === 'declined') {
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
      conversationUrn: conversationUrn!,
      tags: parsed.tags,
      payloadBytes: this.parser.serialize(parsed.payload),
      textContent:
        parsed.payload.kind === 'text' ? parsed.payload.text : undefined,
    };

    await this.storageService.saveMessage(chatMessage);
    accumulator.messages.push(chatMessage);
  }

  private async handleSignal(
    payload: any,
    canonicalSenderUrn: URN,
    accumulator: IngestionResult,
  ): Promise<void> {
    if (payload.action === 'read-receipt') {
      const rr = payload.data as ReadReceiptData;
      const ids = rr?.messageIds || [];
      if (ids.length > 0) {
        for (const msgId of ids) {
          await this.storageService.applyReceipt(
            msgId,
            canonicalSenderUrn,
            'read',
          );
        }
        accumulator.readReceipts.push(...ids);
      }
    } else if (payload.action === 'typing') {
      accumulator.typingIndicators.push(canonicalSenderUrn);
    } else if (payload.action === 'asset-reveal') {
      const patch = payload.data as AssetRevealData;
      const patchedId = await this.handleAssetReveal(patch);
      if (patchedId) {
        accumulator.patchedMessageIds.push(patchedId);
      }
    }
  }

  private async handleAssetReveal(
    patch: AssetRevealData,
  ): Promise<string | null> {
    const msg = await this.storageService.getMessage(patch.messageId);
    if (!msg) return null;

    try {
      if (!msg.payloadBytes) return null;

      const parsed = this.parser.parse(msg.typeId, msg.payloadBytes);
      if (parsed.kind !== 'content') return null;

      const newPayload = { ...parsed.payload, remoteUrl: patch.remoteUrl };
      const newBytes = this.parser.serialize(newPayload);

      await this.storageService.updateMessagePayload(patch.messageId, newBytes);
      return patch.messageId;
    } catch (e) {
      this.logger.error(
        `[Ingestion] Failed to patch message ${patch.messageId}`,
        e,
      );
      return null;
    }
  }
}
