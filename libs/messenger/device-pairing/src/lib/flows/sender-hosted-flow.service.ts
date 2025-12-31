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
import { HotQueueMonitor } from '../workers/hot-queue-monitor.service';

@Injectable({ providedIn: 'root' })
export class SenderHostedFlowService {
  private logger = inject(Logger);
  private crypto = inject(MessengerCryptoService);
  private sendService = inject(ChatSendService);
  private spy = inject(HotQueueMonitor);

  // ✅ NEW: Inject Resolver
  private identityResolver = inject(IdentityResolver);

  /**
   * ROLE: SOURCE (The Logged-in Device)
   * Action: Generates AES Key, Encrypts Identity Keys, Sends to SELF (Dead Drop).
   */
  async startSession(
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<DevicePairingSession> {
    this.logger.info('[SenderFlow] Starting session (AES)...');

    // 1. Generate AES Session Key
    const session = await this.crypto.generateSenderSession();

    // 2. Serialize Identity Keys
    const payloadBytes = await this.serializeKeys(myKeys);

    // 3. Resolve Identity -> Handle
    // We must drop the package in the "Handle" mailbox because that is what
    // the target device will be polling.
    let targetUrn = myUrn;
    try {
      targetUrn = await this.identityResolver.resolveToHandle(myUrn);
      this.logger.info(
        `[SenderFlow] Resolving Dead Drop: ${myUrn} -> ${targetUrn}`,
      );
    } catch (e) {
      this.logger.warn(
        '[SenderFlow] Failed to resolve handle, defaulting to Auth ID',
        e,
      );
    }

    // 4. Construct Payload
    // The "Sender" inside the envelope remains the canonical Auth ID.
    const messagePayload: TransportMessage = {
      senderId: myUrn,
      sentTimestamp: new Date().toISOString() as ISODateTimeString,
      typeId: URN.parse(MESSAGE_TYPE_DEVICE_SYNC),
      payloadBytes: payloadBytes,
    };

    // 5. Encrypt with Session Key
    const envelope = await this.crypto.encryptSyncOffer(
      messagePayload,
      session.oneTimeKey!,
    );

    // 6. Address & Prioritize
    envelope.recipientId = targetUrn; // ✅ Send to the Handle
    envelope.isEphemeral = true;
    (envelope as any).priority = Priority.High;

    this.logger.info(
      `[SenderFlow] 📤 Sending Dead Drop to: ${targetUrn.toString()}`,
    );

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
    myUrn: URN,
  ): Promise<PrivateKeys | null> {
    this.logger.info('[SenderFlow] Redeeming scanned QR...');

    const parsed = await this.crypto.parseQrCode(qrCode);
    if (parsed.mode !== 'SENDER_HOSTED') {
      throw new Error(
        `[SenderFlow] Invalid QR Mode. Expected SENDER_HOSTED, got ${parsed.mode}`,
      );
    }

    // Polling Loop (Retry logic)
    const maxRetries = 10;
    const delayMs = 1500; // Increased slightly to allow propagation

    for (let i = 0; i < maxRetries; i++) {
      const decryptedPayload = await this.spy.checkQueueForInvite(
        parsed.key,
        myUrn,
      );

      if (decryptedPayload) {
        this.logger.info('[SenderFlow] Payload retrieved and decrypted!');
        return this.deserializeKeys(decryptedPayload.payloadBytes);
      }

      this.logger.debug(
        `[SenderFlow] Attempt ${i + 1}/${maxRetries}: No invite found yet.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    this.logger.warn('[SenderFlow] Timed out waiting for sync offer.');
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

    const rsaOaep = { name: 'RSA-OAEP', hash: 'SHA-256' };
    const rsaPss = { name: 'RSA-PSS', hash: 'SHA-256' };

    const encKey = await crypto.subtle.importKey(
      'jwk',
      jwks.enc,
      rsaOaep,
      true,
      ['decrypt'],
    );
    const sigKey = await crypto.subtle.importKey(
      'jwk',
      jwks.sig,
      rsaPss,
      true,
      ['sign'],
    );

    return { encKey, sigKey };
  }
}
