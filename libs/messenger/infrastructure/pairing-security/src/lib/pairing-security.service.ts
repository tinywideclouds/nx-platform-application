import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

// We import the CryptoEngine helper (assuming it's still accessible or moved here)
import {
  CryptoEngine,
  rsaOaepImportParams,
} from '@nx-platform-application/messenger-infrastructure-private-keys';

export interface ReceiverSession {
  sessionId: string;
  qrPayload: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

export interface SenderSession {
  sessionId: string;
  qrPayload: string;
  oneTimeKey: CryptoKey;
}

export interface ParsedQr {
  sessionId: string;
  key: CryptoKey;
  mode: 'RECEIVER_HOSTED' | 'SENDER_HOSTED';
}

@Injectable({ providedIn: 'root' })
export class PairingSecurityService {
  private readonly logger = inject(Logger);

  private readonly cryptoEngine = inject(CryptoEngine);

  public async generateReceiverSession(): Promise<ReceiverSession> {
    const keyPair = await this.cryptoEngine.generateEncryptionKeys();
    const sessionId = crypto.randomUUID();

    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const keyString = this.arrayBufferToBase64(spki);

    const qrPayload = JSON.stringify({
      sid: sessionId,
      key: keyString,
      m: 'rh', // Receiver Hosted
      v: 1,
    });

    return {
      sessionId,
      qrPayload,
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
    };
  }

  public async generateSenderSession(): Promise<SenderSession> {
    const oneTimeKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    const sessionId = crypto.randomUUID();

    const rawKey = await crypto.subtle.exportKey('raw', oneTimeKey);
    const keyString = this.arrayBufferToBase64(rawKey);

    const qrPayload = JSON.stringify({
      sid: sessionId,
      key: keyString,
      m: 'sh', // Sender Hosted
      v: 1,
    });

    return {
      sessionId,
      qrPayload,
      oneTimeKey,
    };
  }

  /**
   * Parses a raw QR string and imports the contained key.
   * Validates the mode 'm' BEFORE decoding the key to ensure safety.
   */
  public async parseQrCode(qrString: string): Promise<ParsedQr> {
    let data: { sid: string; key: string; m: string; v: number };
    try {
      data = JSON.parse(qrString);
    } catch (e) {
      throw new Error('Invalid QR Format: Not JSON');
    }

    let key: CryptoKey;
    let mode: 'RECEIVER_HOSTED' | 'SENDER_HOSTED';

    if (data.m === 'rh') {
      mode = 'RECEIVER_HOSTED';
      const binaryKey = this.base64ToArrayBuffer(data.key);
      key = await crypto.subtle.importKey(
        'spki',
        binaryKey,
        rsaOaepImportParams,
        true,
        ['encrypt'],
      );
    } else if (data.m === 'sh') {
      mode = 'SENDER_HOSTED';
      const binaryKey = this.base64ToArrayBuffer(data.key);
      key = await crypto.subtle.importKey(
        'raw',
        binaryKey,
        { name: 'AES-GCM' },
        true,
        ['decrypt'],
      );
    } else {
      throw new Error(`Unknown QR Mode: ${data.m}`);
    }

    return {
      sessionId: data.sid,
      key,
      mode,
    };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary_string = window.atob(base64);
    const bytes = new Uint8Array(binary_string.length);
    for (let i = 0; i < binary_string.length; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
