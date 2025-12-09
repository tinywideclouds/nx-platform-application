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
  EncryptedMessagePayload,
  DevicePairingSession,
} from '@nx-platform-application/messenger-types';
import { MESSAGE_TYPE_DEVICE_SYNC } from '@nx-platform-application/message-content';

import { HotQueueMonitor } from '../workers/hot-queue-monitor.service';

@Injectable({ providedIn: 'root' })
export class SenderHostedFlowService {
  private logger = inject(Logger);
  private crypto = inject(MessengerCryptoService);
  private sendService = inject(ChatSendService);
  private spy = inject(HotQueueMonitor);

  /**
   * ROLE: SOURCE (The Logged-in Device)
   * Action: Generates AES Key, Encrypts Identity Keys, Sends to SELF (Dead Drop).
   */
  async startSession(
    myKeys: PrivateKeys,
    myUrn: URN
  ): Promise<DevicePairingSession> {
    this.logger.info('[SenderFlow] Starting session (AES)...');

    // 1. Generate AES Session Key (Symmetric)
    // This key will be embedded in the QR code.
    const session = await this.crypto.generateSenderSession();

    // 2. Serialize Identity Keys
    const payloadBytes = await this.serializeKeys(myKeys);

    // 3. Construct Payload
    const messagePayload: EncryptedMessagePayload = {
      senderId: myUrn,
      sentTimestamp: new Date().toISOString() as ISODateTimeString,
      typeId: URN.parse(MESSAGE_TYPE_DEVICE_SYNC),
      payloadBytes: payloadBytes,
    };

    // 4. Encrypt with Session Key (Symmetric)
    // We encrypt this FOR the session key holder (the person who scans the QR)
    const envelope = await this.crypto.encryptSyncOffer(
      messagePayload,
      session.oneTimeKey!
    );

    // 5. Dead Drop Strategy
    // We send this message to *ourselves* (recipientId = myUrn).
    // The Target device will login as us (or connect to our queue) and find it.
    envelope.recipientId = myUrn;
    envelope.isEphemeral = true;
    (envelope as any).priority = Priority.High;

    this.logger.info('[SenderFlow] Dropping keys in Hot Queue...');
    await firstValueFrom(this.sendService.sendMessage(envelope));

    return {
      sessionId: session.sessionId,
      qrPayload: session.qrPayload,
      oneTimeKey: session.oneTimeKey,
      mode: 'SENDER_HOSTED',
    };
  }

  /**
   * ROLE: TARGET (The New Device)
   * Action: Scans QR (gets AES Key), Polls Hot Queue, Decrypts.
   */
  async redeemScannedQr(
    qrCode: string,
    myUrn: URN
  ): Promise<PrivateKeys | null> {
    this.logger.info('[SenderFlow] Redeeming scanned QR...');

    // 1. Parse & Validate
    const parsed = await this.crypto.parseQrCode(qrCode);
    if (parsed.mode !== 'SENDER_HOSTED') {
      throw new Error(
        `[SenderFlow] Invalid QR Mode. Expected SENDER_HOSTED, got ${parsed.mode}`
      );
    }

    // 2. Poll the Spy
    // The Spy uses the AES key from the QR code to try and decrypt messages in the queue.
    const decryptedPayload = await this.spy.checkQueueForInvite(
      parsed.key, // The AES Key from QR
      myUrn
    );

    if (decryptedPayload) {
      this.logger.info('[SenderFlow] Payload retrieved and decrypted!');
      return this.deserializeKeys(decryptedPayload.payloadBytes);
    }

    this.logger.debug('[SenderFlow] No invite found yet.');
    return null;
  }

  // --- Internal Helpers ---

  private async serializeKeys(keys: PrivateKeys): Promise<Uint8Array> {
    const encJwk = await crypto.subtle.exportKey('jwk', keys.encKey);
    const sigJwk = await crypto.subtle.exportKey('jwk', keys.sigKey);
    const json = JSON.stringify({ enc: encJwk, sig: sigJwk });
    return new TextEncoder().encode(json);
  }

  private async deserializeKeys(bytes: Uint8Array): Promise<PrivateKeys> {
    const json = new TextDecoder().decode(bytes);
    const jwks = JSON.parse(json);

    // Import settings match the Platform Specs for Identity Keys
    const rsaOaep = { name: 'RSA-OAEP', hash: 'SHA-256' };
    const rsaPss = { name: 'RSA-PSS', hash: 'SHA-256' };

    const encKey = await crypto.subtle.importKey(
      'jwk',
      jwks.enc,
      rsaOaep,
      true,
      ['decrypt']
    );
    const sigKey = await crypto.subtle.importKey(
      'jwk',
      jwks.sig,
      rsaPss,
      true,
      ['sign']
    );

    return { encKey, sigKey };
  }
}
