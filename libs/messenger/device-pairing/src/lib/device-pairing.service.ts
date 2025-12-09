import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { PrivateKeys } from '@nx-platform-application/messenger-crypto-bridge';
import { DevicePairingSession } from '@nx-platform-application/messenger-types';

// Flows
import { ReceiverHostedFlowService } from './flows/receiver-hosted-flow.service';
import { SenderHostedFlowService } from './flows/sender-hosted-flow.service';
import { HotQueueSpy } from './workers/hot-queue-spy.service';

/**
 * THE FACADE
 * Unified API for Device Pairing.
 * Delegates to specific flow strategies based on the desired mode.
 */
@Injectable({ providedIn: 'root' })
export class DevicePairingService {
  private receiverFlow = inject(ReceiverHostedFlowService);
  private senderFlow = inject(SenderHostedFlowService);
  private spy = inject(HotQueueSpy);

  // --- MODE A: RECEIVER-HOSTED (Target shows QR) ---

  /**
   * Target: Starts the session and returns the QR payload (RSA).
   */
  async startReceiverSession(): Promise<DevicePairingSession> {
    return this.receiverFlow.startSession();
  }

  /**
   * Target: Polls for the "Trojan Horse" response.
   * Note: We use the generic Spy here directly because the Target already holds the Session Key.
   */
  async pollForReceiverSync(
    sessionPrivateKey: CryptoKey,
    myUrn: URN
  ): Promise<PrivateKeys | null> {
    const payload = await this.spy.checkQueueForInvite(
      sessionPrivateKey,
      myUrn
    );
    if (payload) {
      // If found, we need to deserialize.
      // Since the Spy is generic, we do the final deserialization here or in a util.
      // For consistency, let's reuse the deserialization logic which is standard JWK.
      return this.deserializeKeys(payload.payloadBytes);
    }
    return null;
  }

  /**
   * Source: Scans the Target's QR and sends them the keys.
   */
  async linkTargetDevice(
    qrCode: string,
    myKeys: PrivateKeys,
    myUrn: URN
  ): Promise<void> {
    return this.receiverFlow.processScannedQr(qrCode, myKeys, myUrn);
  }

  // --- MODE B: SENDER-HOSTED (Source shows QR) ---

  /**
   * Source: Starts session, Drops keys in Dead Drop, returns QR payload (AES).
   */
  async startSenderSession(
    myKeys: PrivateKeys,
    myUrn: URN
  ): Promise<DevicePairingSession> {
    return this.senderFlow.startSession(myKeys, myUrn);
  }

  /**
   * Target: Scans Source's QR and redemptions the Dead Drop.
   */
  async redeemSenderSession(
    qrCode: string,
    myUrn: URN
  ): Promise<PrivateKeys | null> {
    return this.senderFlow.redeemScannedQr(qrCode, myUrn);
  }

  // --- Shared Helper ---

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
