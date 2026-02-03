import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  QueuedMessage,
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  TransportMessage,
  serializePayloadToProtoBytes,
} from '@nx-platform-application/messenger-types';
import { MockMessageDef } from '../types';
import { CryptoEngine } from '@nx-platform-application/messenger-infrastructure-private-keys';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

// ✅ BOUNDARIES
import { IdentitySetupService } from './identity-setup.service';
import { MockChatDataService } from '../services/mock-chat-data.service';

import {
  MessageContentParser,
  MessageMetadataService,
  MessageTypeText,
  MessageTypingIndicator,
  MessageTypeReadReceipt,
  MessageTypeImage,
  MessageTypeAssetReveal,
  MessageGroupInvite,
  MessageGroupInviteResponse,
  ContentPayload,
  SignalPayload,
  GroupPayloadFactory,
  MessagePayloadFactory,
} from '@nx-platform-application/messenger-domain-message-content';

import { ScenarioItem } from '../types';

@Injectable({ providedIn: 'root' })
export class WorldMessagingService {
  private logger = inject(Logger).withPrefix('[World:Messaging]');
  private crypto = inject(CryptoEngine);
  private contentParser = inject(MessageContentParser);
  private metadataService = inject(MessageMetadataService);
  private worldIdentity = inject(IdentitySetupService);
  private networkMock = inject(MockChatDataService);

  async deliverMessage(item: ScenarioItem): Promise<void> {
    // 1. DETERMINE RECIPIENT (Publicly Routable Address)
    const recipientUrn = this.worldIdentity.getMyPublicHandle();
    // 🔍 X-RAY LOGGING
    const payloadInfo = this.summarizePayload(item.payload);
    this.logger.info(
      `📨 [World] Generating Reply:\n` +
        `   From:    ${item.senderUrn.toString()}\n` +
        `   To:      ${recipientUrn.toString()}\n` +
        `   Type:    ${payloadInfo.type}\n` +
        `   Content: ${payloadInfo.summary}`,
    );

    this.transmit(
      item.senderUrn,
      recipientUrn,
      item.payload,
      item.conversationUrn,
    );
  }

  private async transmit(
    sender: URN,
    recipient: URN,
    payload: ContentPayload | SignalPayload,
    conversationUrn?: URN,
  ): Promise<void> {
    // 1. FAIL FAST CHECK
    let recipientKey: CryptoKey;
    try {
      const publicKeys = this.worldIdentity.getPublicKey(recipient);
      recipientKey = await window.crypto.subtle.importKey(
        'spki',
        publicKeys.encKey as BufferSource,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt'],
      );
    } catch (e) {
      this.logger.error(`❌ [World] Key missing for ${recipient}`);
      return;
    }

    // 2. CONSTRUCT PAYLOAD
    const { rawBytes, typeId, isEphemeral } = this.resolvePayload(payload);

    // 3. WRAP METADATA
    const contextUrn = conversationUrn || sender;
    const wrappedBytes = this.metadataService.wrap(rawBytes, contextUrn, []);

    // 4. TRANSPORT CONTAINER
    const transport: TransportMessage = {
      senderId: sender,
      sentTimestamp: Temporal.Now.instant().toString() as ISODateTimeString,
      typeId: typeId,
      payloadBytes: wrappedBytes,
    };

    // 5. ENCRYPT & ENQUEUE
    const transportBytes = serializePayloadToProtoBytes(transport);
    const encryptionResult = await this.crypto.encrypt(
      recipientKey,
      transportBytes,
    );

    const artifact: QueuedMessage = {
      id: `queue-${Math.random().toString(36).slice(2)}`,
      envelope: {
        recipientId: recipient,
        encryptedData: encryptionResult.encryptedData,
        encryptedSymmetricKey: encryptionResult.encryptedSymmetricKey,
        signature: new Uint8Array(0),
        isEphemeral: isEphemeral,
      },
    };

    this.networkMock.enqueue(artifact);
  }

  /**
   * ✅ NEW: Protocol Helper for Group Joins
   * Constructs the correct payload structure for accepting an invite.
   */
  async deliverGroupJoinResponse(
    senderUrn: URN, // Who is accepting (Alice)
    groupUrn: URN,
    status: 'joined' | 'declined' = 'joined',
  ): Promise<void> {
    const recipientUrn = this.worldIdentity.getMyPublicHandle(); // "Me" (Inviter)

    this.logger.info(
      `🤝 [World] ${senderUrn.entityId} is accepting invite for Group ${groupUrn.entityId}`,
    );

    // ✅ FACTORY REFACTOR
    // Previous: Manual Object construction
    // New: Use Factory to ensure Domain Compliance
    const content =
      status === 'joined'
        ? GroupPayloadFactory.createJoinedSignal(groupUrn)
        : GroupPayloadFactory.createDeclinedSignal(groupUrn);

    const payload: SignalPayload = {
      action: 'group-join',
      data: content,
    };

    await this.transmit(senderUrn, recipientUrn, payload, groupUrn);
  }

  async seedNetworkQueue(messages: MockMessageDef[]): Promise<void> {
    if (!messages || messages.length === 0) return;

    this.logger.info(
      `🌱 [World] Seeding ${messages.length} messages to network queue...`,
    );

    for (const message of messages) {
      const item: ScenarioItem = {
        id: message.id,
        conversationUrn: message.conversationUrn,
        senderUrn: message.senderUrn,
        sentAt: message.sentAt,
        status: message.status,
        payload: { kind: 'text', text: message.text },
      };

      // Re-use the delivery pipeline to ensure correct encryption/enveloping
      await this.deliverMessage(item);
    }
  }

  // --- HELPERS ---

  private summarizePayload(payload: ContentPayload | SignalPayload): {
    type: string;
    summary: string;
  } {
    console.log('real payload', payload);
    if ('kind' in payload) {
      // Content
      const summary =
        payload.kind === 'text' ? `"${payload.text}"` : `[${payload.kind}]`;
      return { type: 'CONTENT', summary };
    } else {
      // Signal
      return { type: 'SIGNAL', summary: `[Action: ${payload.action}]` };
    }
  }

  private resolvePayload(payload: ContentPayload | SignalPayload) {
    if ('kind' in payload) {
      return {
        rawBytes: this.contentParser.serialize(payload),
        typeId: this.mapContentType(payload.kind),
        isEphemeral: false,
      };
    } else {
      return {
        rawBytes: this.serializeSignal(payload),
        typeId: this.mapSignalType(payload.action),
        isEphemeral: payload.action === 'typing',
      };
    }
  }

  private serializeSignal(payload: SignalPayload): Uint8Array {
    if (payload.action === 'typing') return new Uint8Array(0);

    if (payload.action === 'group-join') {
      const wrapper = payload.data as any; // Cast safely or use type guard
      if (wrapper && wrapper.data) {
        return new TextEncoder().encode(JSON.stringify(wrapper.data));
      }
    }

    if (payload.data)
      return new TextEncoder().encode(JSON.stringify(payload.data));
    return new Uint8Array(0);
  }

  private mapContentType(kind: ContentPayload['kind']): URN {
    switch (kind) {
      case 'text':
        return MessageTypeText;
      case 'image':
        return MessageTypeImage;
      case 'group-invite':
        return MessageGroupInvite;
      case 'group-system':
        return MessageGroupInviteResponse;
      case 'rich':
        return URN.parse('urn:message:content:contact-share');
      default:
        return MessageTypeText;
    }
  }

  private mapSignalType(action: SignalPayload['action']): URN {
    switch (action) {
      case 'typing':
        return MessageTypingIndicator;
      case 'read-receipt':
        return MessageTypeReadReceipt;
      case 'asset-reveal':
        return MessageTypeAssetReveal;
      case 'group-join':
        return MessageGroupInviteResponse;
      default:
        throw new Error(`Unknown signal: ${action}`);
    }
  }
}
