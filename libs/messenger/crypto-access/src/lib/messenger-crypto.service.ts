// libs/messenger/crypto-access/src/lib/messenger-crypto.service.ts

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

import { SecureKeyService } from '@nx-platform-application/messenger-key-access';
import {
  EncryptedMessagePayload,
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

@Injectable({
  providedIn: 'root',
})
export class MessengerCryptoService {
  private crypto = inject(CryptoEngine);
  private logger = inject(Logger);
  private storage: WebKeyStorageProvider = inject(WebKeyDbStore);
  private keyService = inject(SecureKeyService);

  public async generateAndStoreKeys(
    userUrn: URN
  ): Promise<{ privateKeys: PrivateKeys; publicKeys: PublicKeys }> {
    this.logger.debug(`CryptoService: Generating NEW keys for ${userUrn}`);
    const [encKeyPair, sigKeyPair] = await Promise.all([
      this.crypto.generateEncryptionKeys(),
      this.crypto.generateSigningKeys(),
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

    this.logger.debug('CryptoService: Saving private keys to IndexedDB...');
    await Promise.all([
      this.storage.saveJwk(this.getEncKeyUrn(userUrn), encPrivKeyJwk),
      this.storage.saveJwk(this.getSigKeyUrn(userUrn), sigPrivKeyJwk),
    ]);

    this.logger.debug('CryptoService: Uploading public keys to backend...');
    await this.keyService.storeKeys(userUrn, publicKeys);

    return { privateKeys, publicKeys };
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
          encKeyJwk.key_ops as KeyUsage[]
        ),
        crypto.subtle.importKey(
          'jwk',
          sigKeyJwk,
          rsaPssImportParams,
          true,
          sigKeyJwk.key_ops as KeyUsage[]
        ),
      ]);

      return { encKey, sigKey };
    } catch (e) {
      console.error('Failed to import keys from storage:', e);
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

  // --- NEW: Fingerprint Calculation ---
  /**
   * Computes a visual fingerprint (SHA-256) of the public key for user verification.
   * Returns a formatted hex string (e.g. "A1:B2:C3...").
   */
  public async getFingerprint(keyBytes: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(keyBytes));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    return hashArray
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(':')
      .slice(0, 47); // Return first 16 bytes for readability
  }

  private async jwkToSpki(
    privateJwk: JsonWebKey,
    params: any,
    usages: KeyUsage[]
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
      usages
    );

    return crypto.subtle.exportKey('spki', pubKey);
  }

  public async encryptAndSign(
    payload: EncryptedMessagePayload,
    recipientId: URN,
    myPrivateKeys: PrivateKeys,
    recipientPublicKeys: PublicKeys
  ): Promise<SecureEnvelope> {
    const payloadBytes = serializePayloadToProtoBytes(payload);

    const recipientEncKey = await crypto.subtle.importKey(
      'spki',
      recipientPublicKeys.encKey as BufferSource,
      rsaOaepImportParams,
      true,
      ['encrypt']
    );

    const { encryptedSymmetricKey, encryptedData } = await this.crypto.encrypt(
      recipientEncKey,
      payloadBytes
    );

    const signature = await this.crypto.sign(
      myPrivateKeys.sigKey,
      encryptedData
    );

    return {
      recipientId: recipientId,
      encryptedSymmetricKey: encryptedSymmetricKey,
      encryptedData: encryptedData,
      signature: signature,
    };
  }

  public async verifyAndDecrypt(
    envelope: SecureEnvelope,
    myPrivateKeys: PrivateKeys
  ): Promise<EncryptedMessagePayload> {
    const innerPayloadBytes = await this.crypto.decrypt(
      myPrivateKeys.encKey,
      envelope.encryptedSymmetricKey,
      envelope.encryptedData
    );

    const innerPayload = deserializeProtoBytesToPayload(innerPayloadBytes);
    const claimedSenderId = innerPayload.senderId;

    const senderPublicKeys = await this.keyService.getKey(claimedSenderId);

    const senderSigKey = await crypto.subtle.importKey(
      'spki',
      senderPublicKeys.sigKey as BufferSource,
      rsaPssImportParams,
      true,
      ['verify']
    );

    const isValid = await this.crypto.verify(
      senderSigKey,
      envelope.signature,
      envelope.encryptedData
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

  public async clearKeys(): Promise<void> {
    await this.storage.clearDatabase();
  }
}