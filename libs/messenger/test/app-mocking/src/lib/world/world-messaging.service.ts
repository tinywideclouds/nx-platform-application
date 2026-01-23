import { Injectable, inject } from '@angular/core';
import {
  QueuedMessage,
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  TransportMessage,
  serializePayloadToProtoBytes,
} from '@nx-platform-application/messenger-types';
import { CryptoEngine } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
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

    // 1. FAIL FAST CHECK
    let recipientKey: CryptoKey;
    try {
      const publicKeys = this.worldIdentity.getPublicKey(recipientUrn);

      recipientKey = await window.crypto.subtle.importKey(
        'spki',
        publicKeys.encKey as BufferSource,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt'],
      );
    } catch (e) {
      this.logger.error(
        `❌ [World] Delivery Failed: Recipient 'ME' key missing.`,
      );
      throw new Error(
        `Simulation Error: Cannot send message to uninitialized user.`,
      );
    }

    // 2. CONSTRUCT PAYLOAD
    const { rawBytes, typeId, isEphemeral } = this.resolvePayload(item.payload);

    // 3. WRAP METADATA
    const wrappedBytes = this.metadataService.wrap(
      rawBytes,
      item.senderUrn,
      [],
    );

    // 4. TRANSPORT CONTAINER
    const transport: TransportMessage = {
      senderId: item.senderUrn,
      sentTimestamp: item.sentAt as ISODateTimeString,
      typeId: typeId,
      payloadBytes: wrappedBytes,
    };

    // 5. ENCRYPT
    const transportBytes = serializePayloadToProtoBytes(transport);
    const encryptionResult = await this.crypto.encrypt(
      recipientKey,
      transportBytes,
    );

    // 6. DELIVER
    const artifact: QueuedMessage = {
      id: `queue-${item.id}`,
      envelope: {
        recipientId: recipientUrn,
        encryptedData: encryptionResult.encryptedData,
        encryptedSymmetricKey: encryptionResult.encryptedSymmetricKey,
        signature: new Uint8Array(0),
        isEphemeral: isEphemeral,
      },
    };

    this.networkMock.enqueue(artifact);
    this.logger.info(`✅ [World] Artifact Enqueued (ID: ${artifact.id})`);
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
