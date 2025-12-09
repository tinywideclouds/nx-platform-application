import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';
import { URN, Priority } from '@nx-platform-application/platform-types';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-bridge';
import { ChatSendService } from '@nx-platform-application/chat-access';
import { EncryptedMessagePayload } from '@nx-platform-application/messenger-types';

import { ChatIngestionService } from './chat-ingestion.service';
import { MESSAGE_TYPE_DEVICE_SYNC } from '@nx-platform-application/message-content';
import { LinkSession } from './chat-interfaces';

/**
 * WORKER SERVICE
 * Stateless helper for Device Linking Protocol.
 * Orchestrated by ChatService.
 */
@Injectable({ providedIn: 'root' })
export class DeviceLinkService {
  private logger = inject(Logger);
  private crypto = inject(MessengerCryptoService);
  private ingestion = inject(ChatIngestionService);
  private sendService = inject(ChatSendService);

  // --- MODE A: RECEIVER-HOSTED (Target shows QR) ---

  async startTargetSession(): Promise<LinkSession> {
    this.logger.info('DeviceLinkWorker: Starting Receiver-Hosted Session...');
    const session = await this.crypto.generateReceiverSession();

    return {
      sessionId: session.sessionId,
      qrPayload: session.qrPayload,
      publicKey: session.publicKey,
      // We don't return the private key in the interface,
      // but we return the whole session object or reconstruct it.
      // Actually, to match the interface, we can map it:
      mode: 'RECEIVER_HOSTED',
    };
  }

  /**
   * Used by Target Device (Mode A) to poll for the Trojan Horse.
   */
  async checkForSyncMessage(
    myUrn: URN,
    sessionPrivateKey: CryptoKey
  ): Promise<PrivateKeys | null> {
    // 1. Safe Mode Fetch
    // We pass the sessionPrivateKey. ChatIngestionService knows (via algorithm check)
    // that this is an RSA key and will use decryptSyncMessage.
    const result = await this.ingestion.process(
      null,
      myUrn,
      new Set(),
      50,
      true, // Safe Mode
      sessionPrivateKey
    );

    // 2. Check for Payload
    if (result.syncPayload) {
      this.logger.info('DeviceLinkWorker: Sync Payload Found!');
      return this.parseSyncPayload(result.syncPayload);
    }

    return null;
  }

  /**
   * Used by Source Device (Mode A) to scan QR and send keys.
   */
  async linkTargetDevice(
    qrString: string,
    myUrn: URN,
    myKeys: PrivateKeys
  ): Promise<void> {
    this.logger.info('DeviceLinkWorker: Processing QR Code (Link Target)...');

    // 1. Parse QR
    const parsed = await this.crypto.parseQrCode(qrString);

    if (parsed.mode !== 'RECEIVER_HOSTED') {
      throw new Error(
        'QR Mode Mismatch: Scanned a Sender QR but expected Receiver QR.'
      );
    }

    // 2. Encrypt & Send
    this.logger.info('DeviceLinkWorker: Sending keys...');

    const payload: EncryptedMessagePayload = {
      senderId: myUrn,
      sentTimestamp: new Date().toISOString() as any,
      typeId: URN.parse(MESSAGE_TYPE_DEVICE_SYNC),
      payloadBytes: await this.serializeKeysForTransport(myKeys),
    };

    const envelope = await this.crypto.encryptSyncMessage(
      payload,
      parsed.key, // This is the RSA Public Key from QR
      myKeys
    );

    // 3. Set Flags for Server Priority
    envelope.isEphemeral = true;
    (envelope as any).priority = Priority.High;

    await firstValueFrom(this.sendService.sendMessage(envelope));
    this.logger.info('DeviceLinkWorker: Keys sent successfully.');
  }

  // --- MODE B: SENDER-HOSTED (Source shows QR) ---

  async startSourceSession(
    myUrn: URN,
    myKeys: PrivateKeys
  ): Promise<LinkSession> {
    this.logger.info('DeviceLinkWorker: Starting Sender-Hosted Session...');

    // 1. Generate Session (AES)
    const session = await this.crypto.generateSenderSession();

    // 2. Encrypt Keys (Symmetric)
    const payload: EncryptedMessagePayload = {
      senderId: myUrn,
      sentTimestamp: new Date().toISOString() as any,
      typeId: URN.parse(MESSAGE_TYPE_DEVICE_SYNC),
      payloadBytes: await this.serializeKeysForTransport(myKeys),
    };

    const envelope = await this.crypto.encryptSyncOffer(
      payload,
      session.oneTimeKey
    );

    envelope.isEphemeral = true;
    (envelope as any).priority = Priority.High;

    // 3. Send to Self (Dead Drop)
    await firstValueFrom(this.sendService.sendMessage(envelope));

    return {
      sessionId: session.sessionId,
      qrPayload: session.qrPayload,
      oneTimeKey: session.oneTimeKey,
      mode: 'SENDER_HOSTED',
    };
  }

  /**
   * Used by Target Device (Mode B) to redeem the Dead Drop.
   */
  async redeemSourceSession(
    qrString: string,
    myUrn: URN
  ): Promise<PrivateKeys | null> {
    // 1. Parse QR
    const parsed = await this.crypto.parseQrCode(qrString);

    if (parsed.mode !== 'SENDER_HOSTED') {
      throw new Error(
        'QR Mode Mismatch: Scanned a Receiver QR but expected Sender QR.'
      );
    }

    // 2. Poll (Safe Mode)
    // We pass the AES Key. ChatIngestionService knows (via algorithm check)
    // that this is an AES key and will use decryptSyncOffer.
    const result = await this.ingestion.process(
      null,
      myUrn,
      new Set(),
      50,
      true, // Safe Mode
      parsed.key // AES Key
    );

    if (result.syncPayload) {
      return this.parseSyncPayload(result.syncPayload);
    }
    return null;
  }

  // --- Helpers ---

  private async serializeKeysForTransport(
    keys: PrivateKeys
  ): Promise<Uint8Array> {
    const encJwk = await crypto.subtle.exportKey('jwk', keys.encKey);
    const sigJwk = await crypto.subtle.exportKey('jwk', keys.sigKey);
    const json = JSON.stringify({ enc: encJwk, sig: sigJwk });
    return new TextEncoder().encode(json);
  }

  private async parseSyncPayload(
    payload: EncryptedMessagePayload
  ): Promise<PrivateKeys> {
    const json = new TextDecoder().decode(payload.payloadBytes);
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
