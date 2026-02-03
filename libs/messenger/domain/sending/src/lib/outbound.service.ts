import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { Temporal } from '@js-temporal/polyfill';
import { WebCryptoKeys } from '@nx-platform-application/messenger-infrastructure-private-keys';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import {
  ChatStorageService,
  OutboxStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  Conversation,
  MessageDeliveryStatus,
} from '@nx-platform-application/messenger-types';
import {
  MessageTypeText,
  MessageMetadataService,
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

  // Data Assembly Services (Centralized)
  private metadataService = inject(MessageMetadataService);

  // Strategy Injection
  private directStrategy = inject(DirectSendStrategy);
  private networkGroupStrategy = inject(NetworkGroupStrategy);
  private broadcastStrategy = inject(BroadcastStrategy);
  private contactGroupStrategy = inject(ContactGroupStrategy);

  private sessionService = inject(SessionService);

  // --- 1. Standard Routing (The "Smart" Router) ---
  // Routes based on whether the target is a User, a Network Group, or a Local Contact List.
  async sendFromConversation(
    recipientUrn: URN,
    typeId: URN,
    payloadBytes: Uint8Array,
    options: SendOptions = {},
  ): Promise<OutboundResult> {
    const ctx = this.createContext(recipientUrn, typeId, payloadBytes, options);

    // Dynamic Strategy Selection based on URN Type
    const strategy = this.getStrategy(recipientUrn);

    return this.orchestrate(ctx, strategy);
  }

  // --- 2. Broadcast / Invites (Explicit Fan-Out) ---
  // Used by GroupProtocolService for sending invites to a specific list of people.
  async broadcast(
    recipients: URN[], // Explicit invitee list
    conversationUrn: URN, // Context (e.g. Group URN)
    typeId: URN,
    payloadBytes: Uint8Array,
    options: SendOptions = {},
  ): Promise<OutboundResult> {
    const ctx = this.createContext(
      conversationUrn,
      typeId,
      payloadBytes,
      options,
    );

    // Explicitly attach recipients for the Dumb Broadcast Strategy
    ctx.recipients = recipients;

    return this.orchestrate(ctx, this.broadcastStrategy);
  }

  // --- Internal Orchestration (The Execution Engine) ---
  // Centralizes Storage, Resolution, Assembly, and Execution.

  private async orchestrate(
    ctx: SendContext,
    strategy: SendStrategy,
  ): Promise<OutboundResult> {
    // 1. Storage (Persistence Only)
    if (!ctx.isEphemeral && ctx.shouldPersist) {
      await this.storageService.saveMessage(ctx.optimisticMsg);
    }

    // 2. Resolution (Who gets what?)
    // The Strategy resolves the destination URN into specific targets (Handles/Groups).
    let targets: OutboundTarget[] = [];
    try {
      targets = await strategy.getTargets(ctx);
    } catch (err) {
      await this.handleFailure(ctx, err);
      throw err;
    }

    // If targets is empty (e.g. Ephemeral Policy Limit), we return success (Soft Drop)
    if (targets.length === 0) {
      return {
        message: ctx.optimisticMsg,
        outcome: Promise.resolve('sent'),
      };
    }

    targets = await this.resolveTargets(targets);

    console.log('got final targets', targets);

    // 3. Assembly & Execution (What?)
    // We construct the payload (Encryption/Metadata) and execute the transport.
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
      // We return 'failed' status but do not throw, so UI can show retry button.
      return {
        message: ctx.optimisticMsg,
        outcome: Promise.resolve('failed'),
      };
    }
  }

  /**
   * ✅ FIX: Correctly maps Local Contact URNs -> Network URNs
   * Uses Promise.all to handle async lookups and filters failures.
   */
  private async resolveTargets(
    targets: OutboundTarget[],
  ): Promise<OutboundTarget[]> {
    const resolvedTargets = await Promise.all(
      targets.map(async (t) => {
        // Resolve all recipients in parallel
        const recipientPromises = t.recipients.map((r) =>
          this.resolveNetworkUrn(r).catch((e) => {
            this.logger.warn(`[Outbound] Failed to resolve recipient ${r}`, e);
            return null;
          }),
        );

        const recipients = await Promise.all(recipientPromises);

        // Filter out nulls (failed resolutions)
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

  // --- Execution Helpers ---

  private async executeSendEphemeral(
    targets: OutboundTarget[],
    ctx: SendContext,
  ) {
    // Ephemeral messages use raw bytes (no metadata wrapping)
    const payload = ctx.optimisticMsg.payloadBytes || new Uint8Array([]);

    for (const target of targets) {
      this.outboxWorker.sendEphemeralBatch(
        target.recipients,
        ctx.optimisticMsg.typeId,
        payload,
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
      });
    });

    await Promise.all(promises);

    // ✅ FIX: Trigger the worker immediately after queuing.
    // This ensures messages/invites don't sit in 'pending' status indefinitely.
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

  // --- Utility Methods ---

  private getStrategy(recipientUrn: URN): SendStrategy {
    // 1. Groups
    if (recipientUrn.entityType === 'group') {
      if (recipientUrn.namespace === 'messenger') {
        // A. Network Group (Server-Side)
        return this.networkGroupStrategy;
      }
      // B. Local Contact Group (Client-Side Resolution)
      return this.contactGroupStrategy;
    }

    // 2. Default: Direct (1:1)
    return this.directStrategy;
  }

  private createContext(
    conversationUrn: URN,
    typeId: URN,
    payloadBytes: Uint8Array,
    options: SendOptions,
  ): SendContext {
    const timestamp = Temporal.Now.instant().toString() as ISODateTimeString;

    let sender = this.sessionService.snapshot.networkUrn;

    const optimisticMsg: ChatMessage = {
      id: `msg-${crypto.randomUUID()}`,
      senderId: sender,
      conversationUrn: conversationUrn,
      sentTimestamp: timestamp,
      typeId: typeId,
      payloadBytes: payloadBytes,
      tags: options.tags || [],
      textContent: typeId.equals(MessageTypeText)
        ? new TextDecoder().decode(payloadBytes)
        : undefined,
      status: 'pending',
    };

    return {
      conversationUrn: conversationUrn,
      recipientUrn: conversationUrn,
      optimisticMsg,
      isEphemeral: options.isEphemeral ?? false,
      shouldPersist: options.shouldPersist ?? true,
      recipients: undefined,
    };
  }
}
