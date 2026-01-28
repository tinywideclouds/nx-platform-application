import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  QueuedMessage,
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { IChatDataService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import {
  TransportMessage,
  serializePayloadToProtoBytes,
} from '@nx-platform-application/messenger-types';
import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';
import { CryptoEngine } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

import { MockServerNetworkState } from '../types';

@Injectable({ providedIn: 'root' })
export class MockChatDataService implements IChatDataService {
  private logger = inject(Logger).withPrefix('[Mock:Router]');
  private crypto = inject(CryptoEngine);
  private serverQueue: QueuedMessage[] = [];

  enqueue(message: QueuedMessage) {
    this.logger.info(`📨 Enqueueing Runtime Message: ${message.id}`);
    this.serverQueue.push(message);
  }

  loadScenario(config: MockServerNetworkState) {
    this.logger.info(`🔄 Loading Queue: ${config.queuedMessages.length} items`);
    this.serverQueue = config.queuedMessages as any;
  }

  // --- DIRECTOR API ---

  async enqueueText(sender: URN, text: string): Promise<void> {
    const rawBytes = new TextEncoder().encode(text);
    // 1. Wrap (Inner Layer)
    const appPayload = this.wrapPayload(rawBytes, sender);

    // 2. Transport & Encrypt (Outer Layers)
    const queued = await this.createQueuedMessage(
      sender,
      MessageTypeText,
      appPayload,
    );
    this.serverQueue.push(queued);
    this.logger.info(`📥 Enqueued Text from ${sender}`);
  }

  async enqueueSignal(sender: URN, type: URN, payload: any): Promise<void> {
    const rawBytes = new TextEncoder().encode(JSON.stringify(payload));
    // 1. Wrap (Inner Layer)
    const appPayload = this.wrapPayload(rawBytes, sender);

    // 2. Transport & Encrypt (Outer Layers)
    const queued = await this.createQueuedMessage(sender, type, appPayload);
    this.serverQueue.push(queued);
    this.logger.info(`📥 Enqueued Signal: ${type}`);
  }

  // --- HELPERS ---

  private wrapPayload(content: Uint8Array, conversationId: URN): Uint8Array {
    const envelope = {
      c: conversationId.toString(),
      t: [],
      d: Array.from(content),
    };
    return new TextEncoder().encode(JSON.stringify(envelope));
  }

  private async createQueuedMessage(
    sender: URN,
    typeId: URN,
    payloadBytes: Uint8Array,
  ): Promise<QueuedMessage> {
    // Middle Layer: TransportMessage (Unencrypted container)
    const transport: TransportMessage = {
      senderId: sender,
      sentTimestamp: new Date().toISOString() as ISODateTimeString,
      typeId: typeId,
      payloadBytes: payloadBytes, // Contains the JSON envelope
    };

    // Serialize
    const transportBytes = serializePayloadToProtoBytes(transport);

    // Outer Layer: SecureEnvelope (Encrypted)
    const dummyKey = (await this.crypto.generateEncryptionKeys()).publicKey;
    const encrypted = await this.crypto.encrypt(dummyKey, transportBytes);

    return {
      id: `queue-${Date.now()}-${Math.random()}`,
      envelope: {
        recipientId: URN.parse('urn:contacts:user:me'),
        encryptedData: encrypted.encryptedData,
        encryptedSymmetricKey: new Uint8Array(0),
        signature: new Uint8Array(0),
        isEphemeral: false,
      },
    };
  }

  // --- IChatDataService Implementation ---

  getMessageBatch(limit: number = 50): Observable<QueuedMessage[]> {
    const batch = this.serverQueue.slice(0, limit);
    return of(batch);
  }

  acknowledge(messageIds: string[]): Observable<void> {
    this.logger.info(`🗑 Acking messages: ${messageIds.length}`);
    this.serverQueue = this.serverQueue.filter(
      (m) => !messageIds.includes(m.id),
    );
    return of(void 0);
  }
}
