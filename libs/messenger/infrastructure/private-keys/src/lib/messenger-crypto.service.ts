//libs/messenger/infrastructure/crypto-bridge/src/lib/messenger-crypto.service.ts
import { Injectable, inject } from '@angular/core';

import {
  WebKeyStorageProvider,
  WebKeyDbStore,
} from '@nx-platform-application/platform-infrastructure-web-key-storage';
import { URN, PublicKeys } from '@nx-platform-application/platform-types';

import { Logger } from '@nx-platform-application/platform-tools-console-logger';

import {
  CryptoEngine,
  rsaOaepImportParams,
  rsaPssImportParams,
} from './crypto';
import { WebCryptoKeys } from './types';

@Injectable({
  providedIn: 'root',
})
export class MessengerCryptoService {
  private logger = inject(Logger);
  private cryptoEngine = inject(CryptoEngine);
  private storage: WebKeyStorageProvider = inject(WebKeyDbStore);

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
  ): Promise<{ privateKeys: WebCryptoKeys; publicKeys: PublicKeys }> {
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

    const privateKeys: WebCryptoKeys = {
      encKey: encKeyPair.privateKey,
      sigKey: sigKeyPair.privateKey,
    };

    await Promise.all([
      this.storage.saveJwk(this.getEncKeyUrn(userUrn), encPrivKeyJwk),
      this.storage.saveJwk(this.getSigKeyUrn(userUrn), sigPrivKeyJwk),
    ]);

    return { privateKeys, publicKeys };
  }

  public async storeMyKeys(userUrn: URN, keys: WebCryptoKeys): Promise<void> {
    const [encPrivKeyJwk, sigPrivKeyJwk] = await Promise.all([
      crypto.subtle.exportKey('jwk', keys.encKey),
      crypto.subtle.exportKey('jwk', keys.sigKey),
    ]);

    await Promise.all([
      this.storage.saveJwk(this.getEncKeyUrn(userUrn), encPrivKeyJwk),
      this.storage.saveJwk(this.getSigKeyUrn(userUrn), sigPrivKeyJwk),
    ]);
  }

  public async loadMyKeys(userUrn: URN): Promise<WebCryptoKeys | null> {
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

  public async clearKeys(): Promise<void> {
    await this.storage.clearDatabase();
  }
}
