import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { Temporal } from '@js-temporal/polyfill';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import {
  ChatStorageService,
  OutboxStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import {
  URN,
  ISODateTimeString,
  Priority,
} from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  MessageDeliveryStatus,
} from '@nx-platform-application/messenger-types';
import {
  MessageMetadataService,
  MessageContentParser,
  MessageSnippetFactory,
  ContentPayload,
  ParsedMessage,
} from '@nx-platform-application/messenger-domain-message-content';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';

import {
  SendContext,
  SendOptions,
  OutboundResult,
  SendStrategy,
  OutboundTarget,
} from './send-strategy.interface';

// Strategies
import { DirectSendStrategy } from './strategies/direct-send.strategy';
import { NetworkGroupStrategy } from './strategies/group-network.strategy';
import { ContactGroupStrategy } from './strategies/group-contacts.strategy';
import { BroadcastStrategy } from './strategies/broadcast.strategy';

import { SessionService } from '@nx-platform-application/messenger-domain-session';

@Injectable({ providedIn: 'root' })
export class OutboundService {
  private logger = inject(Logger);
  private outboxWorker = inject(OutboxWorkerService);
  private storageService = inject(ChatStorageService);
  private outboxStorage = inject(OutboxStorage);

  private identityResolver = inject(IdentityResolver);
  private metadataService = inject(MessageMetadataService);

  // Content Handling Dependencies
  private contentParser = inject(MessageContentParser);
  private snippetFactory = inject(MessageSnippetFactory);

  // Strategy Injection
  private directStrategy = inject(DirectSendStrategy);
  private networkGroupStrategy = inject(NetworkGroupStrategy);
  private broadcastStrategy = inject(BroadcastStrategy);
  private contactGroupStrategy = inject(ContactGroupStrategy);

  private sessionService = inject(SessionService);

  // --- 1. Standard Routing (The "Smart" Router) ---
  async sendFromConversation(
    recipientUrn: URN,
    typeId: URN,
    content: ContentPayload | Uint8Array,
    options: SendOptions = {},
  ): Promise<OutboundResult> {
    const ctx = this.createContext(recipientUrn, typeId, content, options);
    const strategy = this.getStrategy(recipientUrn);
    return this.orchestrate(ctx, strategy);
  }

  // --- 2. Broadcast / Invites (Explicit Fan-Out) ---
  async broadcast(
    recipients: URN[],
    conversationUrn: URN,
    typeId: URN,
    content: ContentPayload | Uint8Array,
    options: SendOptions = {},
  ): Promise<OutboundResult> {
    const ctx = this.createContext(conversationUrn, typeId, content, options);
    ctx.recipients = recipients;
    return this.orchestrate(ctx, this.broadcastStrategy);
  }

  // --- Internal Orchestration ---
  private async orchestrate(
    ctx: SendContext,
    strategy: SendStrategy,
  ): Promise<OutboundResult> {
    // 1. Storage (Persistence Only)
    // Now creates a complete record WITH snippet
    if (!ctx.isEphemeral && ctx.shouldPersist) {
      await this.storageService.saveMessage(ctx.optimisticMsg);
    }

    // 2. Resolution
    let targets: OutboundTarget[] = [];
    try {
      targets = await strategy.getTargets(ctx);
    } catch (err) {
      await this.handleFailure(ctx, err);
      throw err;
    }

    if (targets.length === 0) {
      return {
        message: ctx.optimisticMsg,
        outcome: Promise.resolve('sent'),
      };
    }

    targets = await this.resolveTargets(targets);

    // 3. Assembly & Execution
    try {
      if (ctx.isEphemeral) {
        await this.executeSendEphemeral(targets, ctx);
        return {
          message: ctx.optimisticMsg,
          outcome: Promise.resolve('sent'),
        };
      } else {
        const outcome = this.executeSendPersistent(targets, ctx);
        return {
          message: ctx.optimisticMsg,
          outcome,
        };
      }
    } catch (err) {
      await this.handleFailure(ctx, err);
      return {
        message: ctx.optimisticMsg,
        outcome: Promise.resolve('failed'),
      };
    }
  }

  // ... (resolveTargets and execute helpers remain the same) ...

  private async resolveTargets(
    targets: OutboundTarget[],
  ): Promise<OutboundTarget[]> {
    const resolvedTargets = await Promise.all(
      targets.map(async (t) => {
        const recipientPromises = t.recipients.map((r) =>
          this.resolveNetworkUrn(r).catch((e) => {
            this.logger.warn(`[Outbound] Failed to resolve recipient ${r}`, e);
            return null;
          }),
        );
        const recipients = await Promise.all(recipientPromises);
        const validRecipients = recipients.filter((r): r is URN => !!r);
        return {
          conversationUrn: t.conversationUrn,
          recipients: validRecipients,
        };
      }),
    );
    return resolvedTargets;
  }

  private async resolveNetworkUrn(strategyUrn: URN): Promise<URN> {
    if (strategyUrn.namespace === 'contacts') {
      return this.identityResolver.resolveToHandle(strategyUrn);
    }
    return strategyUrn;
  }

  private async executeSendEphemeral(
    targets: OutboundTarget[],
    ctx: SendContext,
  ) {
    // ✅ FIX: Wrap payload to ensure Conversation ID is transmitted
    // This was previously sending "Naked" bytes, causing the receiver
    // to lose the Group context.
    const rawPayload = ctx.optimisticMsg.payloadBytes || new Uint8Array([]);
    const wirePayload = this.metadataService.wrap(
      rawPayload,
      ctx.conversationUrn,
      ctx.optimisticMsg.tags || [],
    );

    for (const target of targets) {
      this.outboxWorker.sendEphemeralBatch(
        target.recipients,
        ctx.optimisticMsg.typeId,
        wirePayload, // ✅ Sending wrapped payload
      );
    }
  }

  private async executeSendPersistent(
    targets: OutboundTarget[],
    ctx: SendContext,
  ): Promise<MessageDeliveryStatus> {
    const promises = targets.map((target) => {
      const wirePayload = this.metadataService.wrap(
        ctx.optimisticMsg.payloadBytes || new Uint8Array([]),
        ctx.conversationUrn,
        ctx.optimisticMsg.tags || [],
      );

      return this.outboxStorage.enqueue({
        conversationUrn: target.conversationUrn,
        recipients: target.recipients,
        typeId: ctx.optimisticMsg.typeId,
        payload: wirePayload,
        messageId: ctx.optimisticMsg.id,
        tags: ctx.optimisticMsg.tags,
        priority: ctx.priority,
      });
    });

    await Promise.all(promises);
    this.outboxWorker.processQueue();
    return 'pending';
  }

  private async handleFailure(ctx: SendContext, err: any) {
    this.logger.error('Outbound failed', { err, msgId: ctx.optimisticMsg.id });
    if (!ctx.isEphemeral) {
      await this.storageService.updateMessageStatus(
        [ctx.optimisticMsg.id],
        'failed',
      );
    }
  }

  private getStrategy(recipientUrn: URN): SendStrategy {
    if (recipientUrn.entityType === 'group') {
      if (recipientUrn.namespace === 'messenger') {
        return this.networkGroupStrategy;
      }
      return this.contactGroupStrategy;
    }
    return this.directStrategy;
  }

  // --- ✅ NEW: Content Processing Logic ---
  private createContext(
    conversationUrn: URN,
    typeId: URN,
    content: ContentPayload | Uint8Array,
    options: SendOptions,
  ): SendContext {
    const timestamp = Temporal.Now.instant().toString() as ISODateTimeString;
    let sender = this.sessionService.snapshot.networkUrn;

    // 1. Normalize Content (Bytes + Snippet)
    let payloadBytes: Uint8Array;
    let snippet: string;

    if (content instanceof Uint8Array) {
      // Legacy Path: Bytes provided directly
      // We must PARSE it to generate a safe snippet
      payloadBytes = content;
      try {
        const parsed = this.contentParser.parse(typeId, content);
        snippet = this.snippetFactory.createSnippet(parsed);
      } catch (e) {
        snippet = 'Attachment'; // Fallback
      }
    } else {
      // Rich Path: Domain Object provided
      // We serialize it and generate snippet from the object (Fast)
      payloadBytes = this.contentParser.serialize(content);
      const parsed: ParsedMessage = {
        kind: 'content',
        conversationId: conversationUrn,
        tags: options.tags || [],
        payload: content,
      };
      snippet = this.snippetFactory.createSnippet(parsed);
    }

    const optimisticMsg: ChatMessage = {
      id: `msg-${crypto.randomUUID()}`,
      senderId: sender,
      conversationUrn: conversationUrn,
      sentTimestamp: timestamp,
      typeId: typeId,
      payloadBytes: payloadBytes,
      snippet: snippet, // ✅ Now populated!
      tags: options.tags || [],
      status: 'pending',
    };

    return {
      conversationUrn: conversationUrn,
      recipientUrn: conversationUrn,
      optimisticMsg,
      isEphemeral: options.isEphemeral ?? false,
      shouldPersist: options.shouldPersist ?? true,
      priority: options.priority ?? Priority.Normal,
      recipients: undefined,
    };
  }
}
