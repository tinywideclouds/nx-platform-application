//libs/messenger/infrastructure/crypto-bridge/src/lib/messenger-crypto.service.ts
import { Injectable, inject } from '@angular/core';

import {
  WebKeyStorageProvider,
  WebKeyDbStore,
} from '@nx-platform-application/platform-web-key-storage';
import {
  URN,
  PublicKeys,
  SecureEnvelope,
} from '@nx-platform-application/platform-types';

import { SecureKeyService } from '@nx-platform-application/messenger-infrastructure-key-access';
import {
  TransportMessage,
  serializePayloadToProtoBytes,
  deserializeProtoBytesToPayload,
} from '@nx-platform-application/messenger-types';
import { Logger } from '@nx-platform-application/console-logger';

import { CryptoEngine } from './crypto';
import { PrivateKeys } from './types';

const rsaOaepImportParams: RsaHashedImportParams = {
  name: 'RSA-OAEP',
  hash: 'SHA-256',
};
const rsaPssImportParams: RsaHashedImportParams = {
  name: 'RSA-PSS',
  hash: 'SHA-256',
};

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

@Injectable({
  providedIn: 'root',
})
export class MessengerCryptoService {
  private logger = inject(Logger);
  private cryptoEngine = inject(CryptoEngine);
  private storage: WebKeyStorageProvider = inject(WebKeyDbStore);
  private keyService = inject(SecureKeyService);

  // --- 1. Handshake Mechanics (Key Gen & QR Formatting) ---

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

  // --- 2. Identity Verification ---

  public async verifyKeysMatch(
    userUrn: URN,
    server: PublicKeys,
  ): Promise<boolean> {
    try {
      const localPublic = await this.loadMyPublicKeys(userUrn);

      if (!localPublic) {
        this.logger.warn('verifyKeysMatch: Could not derive local public keys');
        return false;
      }

      const encMatch = this.compareBytes(localPublic.encKey, server.encKey);
      const sigMatch = this.compareBytes(localPublic.sigKey, server.sigKey);

      if (!encMatch || !sigMatch) {
        this.logger.warn(
          'Crypto mismatch detected:',
          !encMatch ? 'Encryption Key Mismatch' : '',
          !sigMatch ? 'Signing Key Mismatch' : '',
        );
        return false;
      }

      return true;
    } catch (e) {
      this.logger.error('Failed to verify key match', e);
      return false;
    }
  }

  // --- 3. Key Management (Storage/Load) ---

  public async generateAndStoreKeys(
    userUrn: URN,
  ): Promise<{ privateKeys: PrivateKeys; publicKeys: PublicKeys }> {
    const [encKeyPair, sigKeyPair] = await Promise.all([
      this.cryptoEngine.generateEncryptionKeys(),
      this.cryptoEngine.generateSigningKeys(),
    ]);

    const [encPubKeyRaw, sigPubKeyRaw, encPrivKeyJwk, sigPrivKeyJwk] =
      await Promise.all([
        crypto.subtle.exportKey('spki', encKeyPair.publicKey),
        crypto.subtle.exportKey('spki', sigKeyPair.publicKey),
        crypto.subtle.exportKey('jwk', encKeyPair.privateKey),
        crypto.subtle.exportKey('jwk', sigKeyPair.privateKey),
      ]);

    const publicKeys: PublicKeys = {
      encKey: new Uint8Array(encPubKeyRaw),
      sigKey: new Uint8Array(sigPubKeyRaw),
    };

    const privateKeys: PrivateKeys = {
      encKey: encKeyPair.privateKey,
      sigKey: sigKeyPair.privateKey,
    };

    await Promise.all([
      this.storage.saveJwk(this.getEncKeyUrn(userUrn), encPrivKeyJwk),
      this.storage.saveJwk(this.getSigKeyUrn(userUrn), sigPrivKeyJwk),
    ]);

    await this.keyService.storeKeys(userUrn, publicKeys);

    return { privateKeys, publicKeys };
  }

  public async storeMyKeys(userUrn: URN, keys: PrivateKeys): Promise<void> {
    const [encPrivKeyJwk, sigPrivKeyJwk] = await Promise.all([
      crypto.subtle.exportKey('jwk', keys.encKey),
      crypto.subtle.exportKey('jwk', keys.sigKey),
    ]);

    await Promise.all([
      this.storage.saveJwk(this.getEncKeyUrn(userUrn), encPrivKeyJwk),
      this.storage.saveJwk(this.getSigKeyUrn(userUrn), sigPrivKeyJwk),
    ]);
  }

  public async loadMyKeys(userUrn: URN): Promise<PrivateKeys | null> {
    const [encKeyJwk, sigKeyJwk] = await Promise.all([
      this.storage.loadJwk(this.getEncKeyUrn(userUrn)),
      this.storage.loadJwk(this.getSigKeyUrn(userUrn)),
    ]);

    if (!encKeyJwk || !sigKeyJwk) {
      return null;
    }

    try {
      const [encKey, sigKey] = await Promise.all([
        crypto.subtle.importKey(
          'jwk',
          encKeyJwk,
          rsaOaepImportParams,
          true,
          encKeyJwk.key_ops as KeyUsage[],
        ),
        crypto.subtle.importKey(
          'jwk',
          sigKeyJwk,
          rsaPssImportParams,
          true,
          sigKeyJwk.key_ops as KeyUsage[],
        ),
      ]);

      return { encKey, sigKey };
    } catch (e) {
      this.logger.error('Failed to import keys from storage', e);
      return null;
    }
  }

  public async loadMyPublicKeys(userUrn: URN): Promise<PublicKeys | null> {
    const [encKeyJwk, sigKeyJwk] = await Promise.all([
      this.storage.loadJwk(this.getEncKeyUrn(userUrn)),
      this.storage.loadJwk(this.getSigKeyUrn(userUrn)),
    ]);

    if (!encKeyJwk || !sigKeyJwk) {
      return null;
    }

    try {
      const [encSpki, sigSpki] = await Promise.all([
        this.jwkToSpki(encKeyJwk, rsaOaepImportParams, ['encrypt']),
        this.jwkToSpki(sigKeyJwk, rsaPssImportParams, ['verify']),
      ]);

      return {
        encKey: new Uint8Array(encSpki),
        sigKey: new Uint8Array(sigSpki),
      };
    } catch (e) {
      this.logger.error('Failed to derive public keys from local storage', e);
      return null;
    }
  }

  public async getFingerprint(keyBytes: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new Uint8Array(keyBytes),
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(':')
      .slice(0, 47);
  }

  // --- 4. Encryption / Decryption ---

  public async encryptAndSign(
    payload: TransportMessage,
    recipientId: URN,
    myPrivateKeys: PrivateKeys,
    recipientPublicKeys: PublicKeys,
  ): Promise<SecureEnvelope> {
    const payloadBytes = serializePayloadToProtoBytes(payload);

    const recipientEncKey = await crypto.subtle.importKey(
      'spki',
      recipientPublicKeys.encKey as BufferSource,
      rsaOaepImportParams,
      true,
      ['encrypt'],
    );

    const { encryptedSymmetricKey, encryptedData } =
      await this.cryptoEngine.encrypt(recipientEncKey, payloadBytes);

    const signature = await this.cryptoEngine.sign(
      myPrivateKeys.sigKey,
      encryptedData,
    );

    return {
      recipientId: recipientId,
      encryptedSymmetricKey: encryptedSymmetricKey,
      encryptedData: encryptedData,
      signature: signature,
    };
  }

  public async encryptSyncMessage(
    payload: TransportMessage,
    sessionPublicKey: CryptoKey,
    myPrivateKeys: PrivateKeys,
  ): Promise<SecureEnvelope> {
    const payloadBytes = serializePayloadToProtoBytes(payload);

    const { encryptedSymmetricKey, encryptedData } =
      await this.cryptoEngine.encrypt(sessionPublicKey, payloadBytes);

    const signature = await this.cryptoEngine.sign(
      myPrivateKeys.sigKey,
      encryptedData,
    );

    return {
      recipientId: payload.senderId,
      encryptedSymmetricKey,
      encryptedData,
      signature,
    };
  }

  public async encryptSyncOffer(
    payload: TransportMessage,
    oneTimeKey: CryptoKey,
  ): Promise<SecureEnvelope> {
    const payloadBytes = serializePayloadToProtoBytes(payload);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedContent = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      oneTimeKey,
      new Uint8Array(payloadBytes),
    );

    const encryptedData = new Uint8Array(
      iv.length + encryptedContent.byteLength,
    );
    encryptedData.set(iv, 0);
    encryptedData.set(new Uint8Array(encryptedContent), iv.length);

    return {
      recipientId: payload.senderId,
      encryptedSymmetricKey: new Uint8Array(0),
      encryptedData,
      signature: new Uint8Array(0),
    };
  }

  public async verifyAndDecrypt(
    envelope: SecureEnvelope,
    myPrivateKeys: PrivateKeys,
  ): Promise<TransportMessage> {
    return this.internalVerifyAndDecrypt(envelope, myPrivateKeys.encKey);
  }

  public async decryptSyncMessage(
    envelope: SecureEnvelope,
    sessionPrivateKey: CryptoKey,
  ): Promise<TransportMessage> {
    return this.internalVerifyAndDecrypt(envelope, sessionPrivateKey);
  }

  public async decryptSyncOffer(
    envelope: SecureEnvelope,
    oneTimeKey: CryptoKey,
  ): Promise<TransportMessage> {
    const iv = envelope.encryptedData.slice(0, 12);
    const ciphertext = envelope.encryptedData.slice(12);

    const decryptedBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      oneTimeKey,
      ciphertext,
    );

    return deserializeProtoBytesToPayload(new Uint8Array(decryptedBytes));
  }

  // --- Private Helpers ---

  private async internalVerifyAndDecrypt(
    envelope: SecureEnvelope,
    decryptionKey: CryptoKey,
  ): Promise<TransportMessage> {
    const innerPayloadBytes = await this.cryptoEngine.decrypt(
      decryptionKey,
      envelope.encryptedSymmetricKey,
      envelope.encryptedData,
    );

    const innerPayload = deserializeProtoBytesToPayload(innerPayloadBytes);
    const claimedSenderId = innerPayload.senderId;

    const senderPublicKeys = await this.keyService.getKey(claimedSenderId);

    if (!senderPublicKeys) {
      throw new Error(
        `Verification Failed: Could not find public keys for sender ${claimedSenderId}`,
      );
    }

    const senderSigKey = await crypto.subtle.importKey(
      'spki',
      senderPublicKeys.sigKey as BufferSource,
      rsaPssImportParams,
      true,
      ['verify'],
    );

    const isValid = await this.cryptoEngine.verify(
      senderSigKey,
      envelope.signature,
      envelope.encryptedData,
    );

    if (!isValid) {
      throw new Error('Message Forged: Signature verification failed.');
    }

    return innerPayload;
  }

  private getEncKeyUrn(userId: URN): string {
    return `messenger:${userId.toString()}:key:encryption`;
  }

  private getSigKeyUrn(userId: URN): string {
    return `messenger:${userId.toString()}:key:signing`;
  }

  private async jwkToSpki(
    privateJwk: JsonWebKey,
    params: any,
    usages: KeyUsage[],
  ): Promise<ArrayBuffer> {
    const publicJwk: JsonWebKey = {
      kty: privateJwk.kty,
      n: privateJwk.n,
      e: privateJwk.e,
      alg: privateJwk.alg,
      ext: true,
      key_ops: usages,
    };

    const pubKey = await crypto.subtle.importKey(
      'jwk',
      publicJwk,
      params,
      true,
      usages,
    );

    return crypto.subtle.exportKey('spki', pubKey);
  }

  private compareBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, i) => val === b[i]);
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

  public async clearKeys(): Promise<void> {
    await this.storage.clearDatabase();
  }
}
