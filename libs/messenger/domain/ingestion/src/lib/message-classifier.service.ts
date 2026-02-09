import { Injectable, inject } from '@angular/core';
import {
  URN,
  QueuedMessage,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  TransportMessage,
} from '@nx-platform-application/messenger-types';
import { MessageSecurityService } from '@nx-platform-application/messenger-infrastructure-message-security';
import {
  MessageContentParser,
  MessageSnippetFactory,
  ParsedMessage,
  ReadReceiptData,
  AssetRevealData,
} from '@nx-platform-application/messenger-domain-message-content';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';
import { SessionService } from '@nx-platform-application/messenger-domain-session';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

// ✅ NEW: Structured Signal carrier
export interface SignalMessage {
  conversationId: URN;
  senderId: URN;
  payload: any;
}

// --- THE CONTRACT ---
// This tells the Ingestion Service exactly what to do next.
export type IngestionIntent =
  | { kind: 'ephemeral'; message: SignalMessage } // ✅ UPDATED: Structured Ephemeral
  | { kind: 'durable'; message: ChatMessage } // Real Messages (Durable)
  | { kind: 'receipt'; urn: URN; messageIds: string[] } // Receipts (Metadata)
  | { kind: 'asset-reveal'; patch: AssetRevealData } // Patches
  | { kind: 'group-invite'; data: any } // Protocol Action
  | {
      kind: 'group-system';
      data: any;
      sender: URN;
      meta: { id: string; sentAt: string };
    } // Protocol Action
  | { kind: 'drop'; reason: string }; // Blocked/Error

@Injectable({ providedIn: 'root' })
export class MessageClassifier {
  private cryptoService = inject(MessageSecurityService);
  private quarantineService = inject(QuarantineService);
  private parser = inject(MessageContentParser);
  private snippetGenerator = inject(MessageSnippetFactory);
  private sessionService = inject(SessionService);
  private logger = inject(Logger);

  /**
   * Pure Transformation: Raw Queue Item -> Actionable Intent
   * No side effects. No DB writes.
   */
  public async classify(
    item: QueuedMessage,
    blockedSet: Set<string>,
  ): Promise<IngestionIntent> {
    try {
      // 1. Decrypt & Verify Signature
      const myKeys = this.sessionService.snapshot.keys;
      const transport: TransportMessage =
        await this.cryptoService.verifyAndDecrypt(item.envelope, myKeys);

      // 2. Quarantine / Block Check
      const sender = await this.quarantineService.process(
        transport,
        blockedSet,
      );
      if (!sender) {
        return { kind: 'drop', reason: 'blocked_or_quarantined' };
      }

      // 3. Parse Payload
      const parsed = this.parser.parse(
        transport.typeId,
        transport.payloadBytes,
      );

      // 4. Determine Intent
      if (parsed.kind === 'signal') {
        // ✅ FIX: Normalize Conversation ID for Signals (Centralized)
        const conversationId = this.normalizeConversationId(
          parsed.conversationId,
          sender,
        );

        return this.classifySignal(parsed.payload, sender, conversationId);
      } else if (parsed.kind === 'content') {
        return this.classifyContent(parsed, transport, item.id, sender);
      }

      return { kind: 'drop', reason: 'unknown_kind' };
    } catch (error: any) {
      this.logger.warn(`[Classifier] Drop ${item.id}: ${error.message}`);
      return { kind: 'drop', reason: 'decryption_or_parse_failed' };
    }
  }

  private classifySignal(
    payload: any,
    sender: URN,
    conversationId: URN,
  ): IngestionIntent {
    switch (payload.action) {
      case 'typing':
      case 'ping':
        // ✅ UPDATED: Return structured message
        return {
          kind: 'ephemeral',
          message: {
            conversationId,
            senderId: sender,
            payload,
          },
        };
      case 'read-receipt':
        return {
          kind: 'receipt',
          urn: sender,
          messageIds: (payload.data as ReadReceiptData)?.messageIds || [],
        };
      case 'asset-reveal':
        return {
          kind: 'asset-reveal',
          patch: payload.data as AssetRevealData,
        };
      default:
        return { kind: 'drop', reason: 'unknown_signal' };
    }
  }

  private classifyContent(
    parsed: ParsedMessage & { kind: 'content' },
    transport: TransportMessage,
    queueId: string,
    sender: URN,
  ): IngestionIntent {
    // Protocol Messages
    if (parsed.payload.kind === 'group-invite') {
      return { kind: 'group-invite', data: parsed.payload.data };
    }
    if (parsed.payload.kind === 'group-system') {
      return {
        kind: 'group-system',
        data: parsed.payload.data,
        sender,
        meta: {
          id: transport.clientRecordId || queueId,
          sentAt: transport.sentTimestamp,
        },
      };
    }

    // Standard Chat Content
    // ✅ FIX: Use centralized normalization logic
    const conversationUrn = this.normalizeConversationId(
      parsed.conversationId,
      sender,
    );

    const snippet = this.snippetGenerator.createSnippet(parsed);
    const id = transport.clientRecordId || queueId;

    const message: ChatMessage = {
      id,
      senderId: sender,
      sentTimestamp: transport.sentTimestamp as ISODateTimeString,
      typeId: transport.typeId,
      snippet,
      status: 'received',
      conversationUrn: conversationUrn!,
      tags: parsed.tags,
      payloadBytes: this.parser.serialize(parsed.payload),
    };

    return { kind: 'durable', message };
  }

  /**
   * CENTRALIZED LOGIC:
   * Determines the canonical Conversation URN for an incoming item.
   * - Groups: Respect the Group URN.
   * - 1:1: Force it to be the Sender (so Bob's msg -> urn:bob).
   */
  private normalizeConversationId(
    candidateId: URN | undefined,
    sender: URN,
  ): URN {
    if (candidateId && candidateId.entityType === 'group') {
      return candidateId;
    }
    return sender;
  }
}
