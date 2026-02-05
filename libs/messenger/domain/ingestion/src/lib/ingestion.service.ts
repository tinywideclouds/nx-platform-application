import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Subject } from 'rxjs';
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
import { MessageSecurityService } from '@nx-platform-application/messenger-infrastructure-message-security';

import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  MessageContentParser,
  ReadReceiptData,
  AssetRevealData,
  ParsedMessage,
  MessageSnippetFactory,
} from '@nx-platform-application/messenger-domain-message-content';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';
import { ContactProtocolService } from '@nx-platform-application/messenger-domain-contact-protocol';

import { SessionService } from '@nx-platform-application/messenger-domain-session';

export interface IngestionResult {
  messages: ChatMessage[];
  typingIndicators: URN[];
  readReceipts: string[];
  patchedMessageIds: string[];
}

@Injectable({ providedIn: 'root' })
export class IngestionService {
  private dataService = inject(ChatDataService);
  private cryptoService = inject(MessageSecurityService);
  private storageService = inject(ChatStorageService);
  private quarantineService = inject(QuarantineService);
  private parser = inject(MessageContentParser);
  private snippetGenerator = inject(MessageSnippetFactory);

  private groupProtocol = inject(GroupProtocolService);
  private contactProtocol = inject(ContactProtocolService);

  private readonly sessionService = inject(SessionService);

  private logger = inject(Logger);

  private readonly _dataIngested = new Subject<IngestionResult>();
  public readonly dataIngested$ = this._dataIngested.asObservable();

  async process(
    blockedSet: Set<string>,
    batchSize = 50,
  ): Promise<IngestionResult> {
    const finalResult: IngestionResult = {
      messages: [],
      typingIndicators: [],
      readReceipts: [],
      patchedMessageIds: [],
    };

    let hasMore = true;

    while (hasMore) {
      const queue = await firstValueFrom(
        this.dataService.getMessageBatch(batchSize),
      );

      if (!queue || queue.length === 0) {
        break;
      }

      const processedIds: string[] = [];

      for (const item of queue) {
        try {
          await this.processSingleMessage(item, blockedSet, finalResult);
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

      if (queue.length < batchSize) {
        hasMore = false;
      }
    }

    this._dataIngested.next(finalResult);

    return finalResult;
  }

  private async processSingleMessage(
    item: QueuedMessage,
    blockedSet: Set<string>,
    accumulator: IngestionResult,
  ): Promise<void> {
    const myKeys = this.sessionService.snapshot.keys;

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

  private async routeAndProcess(
    transport: TransportMessage,
    queueId: string,
    canonicalSenderUrn: URN,
    accumulator: IngestionResult,
  ): Promise<void> {
    const typeId = transport.typeId;
    const isSignal = typeId.entityType === 'signal';

    const parsed = this.parser.parse(typeId, transport.payloadBytes);

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

    this.logger.warn(
      `[Ingestion] Dropped Unhandled: Transport=${typeId.toString()}, Parser=${
        parsed.kind
      }`,
    );
  }

  private async handleContent(
    parsed: ParsedMessage & { kind: 'content' },
    transport: TransportMessage,
    queueId: string,
    canonicalSenderUrn: URN,
    accumulator: IngestionResult,
  ): Promise<void> {
    const canonicalId = transport.clientRecordId || queueId;

    // CHECK - is the parsed.conversationId not always right - if not why not?
    const conversationUrn =
      parsed.conversationId.entityType === 'group'
        ? parsed.conversationId
        : canonicalSenderUrn;

    if (parsed.kind === 'content' && parsed.payload.kind === 'group-invite') {
      await this.groupProtocol.processIncomingInvite(parsed.payload.data);
    }

    if (parsed.payload.kind === 'group-system') {
      try {
        const systemMessage = await this.groupProtocol.processSignal(
          parsed.payload.data,
          canonicalSenderUrn,
          { messageId: canonicalId, sentAt: transport.sentTimestamp },
        );

        // If Protocol returned a message, save it to history
        if (systemMessage) {
          await this.storageService.saveMessage(systemMessage);
          accumulator.messages.push(systemMessage);
        }

        // 🚩 FIX: Stop here!
        // Do not let the generic logic below overwrite this message.
        console.log('saved system message', systemMessage);
        return;
      } catch (e) {
        this.logger.error('[Ingestion] Failed to update group roster', e);
      }
    } else {
      // "Before we save this DM, ensure the session exists."
      await this.contactProtocol.ensureSession(canonicalSenderUrn);
    }

    const snippet = this.snippetGenerator.createSnippet(parsed);

    const chatMessage: ChatMessage = {
      id: canonicalId,
      senderId: canonicalSenderUrn,
      sentTimestamp: transport.sentTimestamp as ISODateTimeString,
      typeId: transport.typeId,
      snippet: snippet,
      status: 'received',
      conversationUrn: conversationUrn!,
      tags: parsed.tags,
      payloadBytes: this.parser.serialize(parsed.payload),
    };

    console.log('handling context save', chatMessage);
    await this.storageService.saveMessage(chatMessage);
    accumulator.messages.push(chatMessage);
  }

  private async handleSignal(
    payload: any,
    canonicalSenderUrn: URN,
    accumulator: IngestionResult,
  ): Promise<void> {
    switch (payload.action) {
      case 'typing': {
        accumulator.typingIndicators.push(canonicalSenderUrn);
        break;
      }
      case 'read-receipt': {
        const rr = payload.data as ReadReceiptData;
        const ids = rr?.messageIds || [];

        console.log('handling read receipt', rr);
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
        break;
      }
      case 'asset-reveal': {
        const patch = payload.data as AssetRevealData;
        const patchedId = await this.handleAssetReveal(patch);
        if (patchedId) {
          accumulator.patchedMessageIds.push(patchedId);
        }
        break;
      }
      default: {
        this.logger.warn(
          `[Ingestion] Unhandled Signal Action: ${payload.action}`,
        );
      }
    }
  }

  private async handleAssetReveal(
    patch: AssetRevealData,
  ): Promise<string | null> {
    const msg = await this.storageService.getMessage(patch.messageId);
    if (!msg) return null;

    try {
      if (!msg.payloadBytes) {
        return null;
      }

      const parsed = this.parser.parse(msg.typeId, msg.payloadBytes);
      if (parsed.kind !== 'content') {
        return null;
      }

      const newPayload = {
        ...parsed.payload,
        assets: patch.assets,
      };

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
