import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { CryptoEngine } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import {
  MessageMetadataService,
  MessageContentParser,
  ParsedMessage,
} from '@nx-platform-application/messenger-domain-message-content';

// PROTOBUF UNMARSHALLING
import { fromBinary } from '@bufbuild/protobuf';
import { transportMessageFromProto } from '@nx-platform-application/messenger-types';
import { EncryptedMessagePayloadPbSchema } from '@nx-platform-application/messenger-protos/message/v1/payload_pb.js';

import { MockChatSendService } from '../services/mock-chat-send.service';
import { IdentitySetupService } from './identity-setup.service';

export interface WorldInboxMessage {
  senderId: URN;
  recipientId: URN;
  content: ParsedMessage; // Readable Content (Text, Image, Signal)
  transportId?: string;
}

@Injectable({ providedIn: 'root' })
export class WorldInboxService {
  private logger = inject(Logger).withPrefix('[World:Inbox]');
  private crypto = inject(CryptoEngine);
  private metadata = inject(MessageMetadataService);
  private parser = inject(MessageContentParser);

  // The Source of Truth for Keys
  private worldIdentity = inject(IdentitySetupService);

  // The Raw Encrypted Stream from the App
  private sendService = inject(MockChatSendService);

  // ✅ OUTPUT: Readable messages for the Director
  public readonly messages$ = new Subject<WorldInboxMessage>();

  constructor() {
    this.initializeListener();
  }

  private initializeListener() {
    this.sendService.outboundMessage$.subscribe(async (event) => {
      try {
        const envelope = event.envelope;
        const recipient = envelope.recipientId;

        this.logger.info(`📬 [World] received message ${recipient}`);

        // 1. CHECK RECIPIENT: Do we control this user in the World?
        // (e.g. Is this for Alice?)
        let privateKey: CryptoKey;
        try {
          privateKey = this.worldIdentity.getPrivateKey(recipient);
        } catch {
          this.logger.warn(`📬 [World] no keys for ${recipient}`);
          // We don't have keys for this recipient (maybe it's a real user or system).
          // Ignore it.
          return;
        }

        // 2. DECRYPT: "Alice" unlocks the message
        // Uses the exact logic from crypto.ts (decrypt symmetric key, then data)
        const decryptedBytes = await this.crypto.decrypt(
          privateKey,
          envelope.encryptedSymmetricKey,
          envelope.encryptedData,
        );

        // 3. DESERIALIZE: Proto -> Transport Object
        const proto = fromBinary(
          EncryptedMessagePayloadPbSchema,
          decryptedBytes,
        );
        const transport = transportMessageFromProto(proto);

        // 4. UNWRAP: Protocol Metadata (Conversation ID, Tags) -> Raw Payload
        const wrapped = this.metadata.unwrap(transport.payloadBytes);

        // 5. PARSE: Bytes -> Domain Content (Text, Signals, etc.)
        const parsed = this.parser.parse(transport.typeId, wrapped.content);

        this.logger.info(
          `📬 [World] Alice received message from ${transport.senderId}`,
        );

        // 6. EMIT: Notify the Director
        this.messages$.next({
          senderId: transport.senderId,
          recipientId: recipient,
          content: parsed,
          transportId: transport.clientRecordId,
        });
      } catch (err) {
        this.logger.error('Failed to process inbound world message', err);
      }
    });
  }
}
