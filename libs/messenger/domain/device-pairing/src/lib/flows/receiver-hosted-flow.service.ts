import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { WebCryptoKeys } from '@nx-platform-application/messenger-infrastructure-private-keys';
import { ChatSendService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import {
  URN,
  Priority,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  TransportMessage,
  DevicePairingSession,
} from '@nx-platform-application/messenger-types';
import { MESSAGE_TYPE_DEVICE_SYNC } from '@nx-platform-application/messenger-domain-message-content';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';

import { PairingSecurityService } from '@nx-platform-application/messenger-infrastructure-pairing-security';
import { MessageSecurityService } from '@nx-platform-application/messenger-infrastructure-message-security';

@Injectable({ providedIn: 'root' })
export class ReceiverHostedFlowService {
  private logger = inject(Logger);
  private crypto = inject(MessageSecurityService);
  private pairing = inject(PairingSecurityService);
  private sendService = inject(ChatSendService);
  private identityResolver = inject(IdentityResolver);

  /**
   * ROLE: TARGET (The New Device)
   * Action: Generates an RSA Keypair and a QR payload containing the Public Key.
   */
  async startSession(): Promise<DevicePairingSession> {
    this.logger.info('[ReceiverFlow] Starting session (RSA)...');

    const session = await this.pairing.generateReceiverSession();

    return {
      sessionId: session.sessionId,
      qrPayload: session.qrPayload,
      publicKey: session.publicKey,
      privateKey: session.privateKey,
      mode: 'RECEIVER_HOSTED',
    };
  }

  /**
   * ROLE: SOURCE (The Logged-in Device)
   * Action: Scans QR, Encrypts Identity Keys with QR's Public Key, Sends to Hot Queue.
   */
  async processScannedQr(
    qrCode: string,
    myKeys: WebCryptoKeys,
    myUrn: URN,
  ): Promise<void> {
    this.logger.info('[ReceiverFlow] Processing scanned QR...');

    const parsed = await this.pairing.parseQrCode(qrCode);
    if (parsed.mode !== 'RECEIVER_HOSTED') {
      throw new Error(
        `[ReceiverFlow] Invalid QR Mode. Expected RECEIVER_HOSTED, got ${parsed.mode}`,
      );
    }

    const payloadBytes = await this.serializeKeys(myKeys);

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

    const messagePayload: TransportMessage = {
      senderId: myUrn,
      sentTimestamp: Temporal.Now.instant().toString() as ISODateTimeString,
      typeId: URN.parse(MESSAGE_TYPE_DEVICE_SYNC),
      payloadBytes: payloadBytes,
    };

    const envelope = await this.crypto.encryptSyncMessage(
      messagePayload,
      parsed.key,
      myKeys,
    );

    envelope.recipientId = targetUrn;
    envelope.isEphemeral = true;
    (envelope as any).priority = Priority.High;

    this.logger.info(
      `[ReceiverFlow] 📤 Sending encrypted keys to: ${targetUrn.toString()}`,
    );
    await firstValueFrom(this.sendService.sendMessage(envelope));
  }

  private async serializeKeys(keys: WebCryptoKeys): Promise<Uint8Array> {
    const encJwk = await crypto.subtle.exportKey('jwk', keys.encKey);
    const sigJwk = await crypto.subtle.exportKey('jwk', keys.sigKey);

    const json = JSON.stringify({ enc: encJwk, sig: sigJwk });
    return new TextEncoder().encode(json);
  }
}
