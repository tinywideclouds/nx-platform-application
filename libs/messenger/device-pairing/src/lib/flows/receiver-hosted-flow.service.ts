import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-bridge';
import { ChatSendService } from '@nx-platform-application/chat-access';
import {
  URN,
  Priority,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  TransportMessage,
  DevicePairingSession,
} from '@nx-platform-application/messenger-types';
import { MESSAGE_TYPE_DEVICE_SYNC } from '@nx-platform-application/message-content';

// ✅ NEW: Import Adapter
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';

@Injectable({ providedIn: 'root' })
export class ReceiverHostedFlowService {
  private logger = inject(Logger);
  private crypto = inject(MessengerCryptoService);
  private sendService = inject(ChatSendService);

  // ✅ NEW: Inject Resolver
  private identityResolver = inject(IdentityResolver);

  /**
   * ROLE: TARGET (The New Device)
   * Action: Generates an RSA Keypair and a QR payload containing the Public Key.
   */
  async startSession(): Promise<DevicePairingSession> {
    this.logger.info('[ReceiverFlow] Starting session (RSA)...');

    // 1. Generate RSA Keys (Public goes in QR, Private stays in memory)
    const session = await this.crypto.generateReceiverSession();

    return {
      sessionId: session.sessionId,
      qrPayload: session.qrPayload,
      publicKey: session.publicKey, // RSA Public
      privateKey: session.privateKey, // RSA Private (Needed to decrypt response)
      mode: 'RECEIVER_HOSTED',
    };
  }

  /**
   * ROLE: SOURCE (The Logged-in Device)
   * Action: Scans QR, Encrypts Identity Keys with QR's Public Key, Sends to Hot Queue.
   */
  async processScannedQr(
    qrCode: string,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    this.logger.info('[ReceiverFlow] Processing scanned QR...');

    // 1. Parse & Validate
    const parsed = await this.crypto.parseQrCode(qrCode);
    if (parsed.mode !== 'RECEIVER_HOSTED') {
      throw new Error(
        `[ReceiverFlow] Invalid QR Mode. Expected RECEIVER_HOSTED, got ${parsed.mode}`,
      );
    }

    // 2. Serialize Identity Keys
    const payloadBytes = await this.serializeKeys(myKeys);

    // ✅ FIX: Resolve Identity -> Handle
    // Ensure we address the message to the mailbox the Target is actually polling.
    let targetUrn = myUrn;
    try {
      targetUrn = await this.identityResolver.resolveToHandle(myUrn);
      this.logger.info(
        `[ReceiverFlow] Resolved Target: ${myUrn} -> ${targetUrn}`,
      );
    } catch (e) {
      this.logger.warn(
        '[ReceiverFlow] Failed to resolve handle, defaulting to Auth ID',
        e,
      );
    }

    // 3. Construct Payload
    // Sender ID remains the canonical Auth ID so the Target knows it's trustworthy.
    const messagePayload: TransportMessage = {
      senderId: myUrn,
      sentTimestamp: new Date().toISOString() as ISODateTimeString,
      typeId: URN.parse(MESSAGE_TYPE_DEVICE_SYNC),
      payloadBytes: payloadBytes,
    };

    // 4. Encrypt with Target's Public Key (from QR)
    const envelope = await this.crypto.encryptSyncMessage(
      messagePayload,
      parsed.key,
      myKeys,
    );

    // 5. Set Routing & Priority Flags
    envelope.recipientId = targetUrn; // ✅ Send to the Handle
    envelope.isEphemeral = true;
    (envelope as any).priority = Priority.High;

    // 6. Send
    this.logger.info(
      `[ReceiverFlow] 📤 Sending encrypted keys to: ${targetUrn.toString()}`,
    );
    await firstValueFrom(this.sendService.sendMessage(envelope));
  }

  // --- Internal Helper ---

  private async serializeKeys(keys: PrivateKeys): Promise<Uint8Array> {
    const encJwk = await crypto.subtle.exportKey('jwk', keys.encKey);
    const sigJwk = await crypto.subtle.exportKey('jwk', keys.sigKey);

    const json = JSON.stringify({ enc: encJwk, sig: sigJwk });
    return new TextEncoder().encode(json);
  }
}
