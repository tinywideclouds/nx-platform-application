import { Injectable, inject } from '@angular/core';
import { URN, PublicKeys } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  PrivateKeyService,
  WebCryptoKeys,
} from '@nx-platform-application/messenger-infrastructure-private-keys';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';

@Injectable({ providedIn: 'root' })
export class KeyLifecycleService {
  private readonly logger = inject(Logger);
  private readonly crypto = inject(PrivateKeyService);
  private readonly cache = inject(KeyCacheService);

  /**
   * Orchestrates the creation of a fresh identity.
   * * 1. Calls CryptoService to generate KeyPairs (Private + Public).
   * 2. CryptoService saves Private Keys to IndexedDB (implicitly).
   * 3. WE explicitly take the Public Keys and push them to the KeyCacheService.
   * 4. Returns Private Keys for the active Session.
   */
  async createIdentity(authUrn: URN): Promise<WebCryptoKeys> {
    this.logger.info(`[KeyLifecycle] Creating new identity for ${authUrn}`);

    // 1. Generate via Crypto Bridge
    // This returns { privateKeys: PrivateKeys, publicKeys: PublicKeys }
    const generated = await this.crypto.generateAndStoreKeys(authUrn);

    // 2. Publish PUBLIC keys (Uint8Arrays) to Cache/Network
    // This primes the local cache AND uploads to the Key Service
    await this.cache.storeKeys(authUrn, generated.publicKeys);

    // 3. Return PRIVATE keys (CryptoKey objects) for the Session
    return generated.privateKeys;
  }

  /**
   * Restores identity from local storage.
   * Checks if Public Keys are missing from the cache and repairs them if needed.
   */
  async restoreIdentity(authUrn: URN): Promise<WebCryptoKeys | null> {
    // 1. Load Private Keys (CryptoKey objects)
    const privateKeys = await this.crypto.loadMyKeys(authUrn);
    if (!privateKeys) return null;

    // 2. Self-Healing: Ensure Public Keys are in the cache
    // (In case the cache was wiped but keys persisted, or we are on a new device with synced keys)
    try {
      const hasPublic = await this.cache.hasKeys(authUrn);

      if (!hasPublic) {
        this.logger.warn(
          '[KeyLifecycle] Public keys missing from cache. Repairing...',
        );

        // We assume CryptoService can retrieve the raw Public Keys associated with this user
        // without needing to regenerate them.
        const publicBytes = await this.crypto.loadMyPublicKeys(authUrn);

        if (publicBytes) {
          await this.cache.storeKeys(authUrn, publicBytes);
        }
      }
    } catch (e) {
      this.logger.error('[KeyLifecycle] Restore consistency check failed', e);
      // We don't block here; if we have private keys, we can likely still decrypt incoming messages.
    }

    return privateKeys;
  }

  /**
   * Imports an identity (e.g. from Device Linking).
   */
  async importIdentity(authUrn: URN, keys: WebCryptoKeys): Promise<void> {
    this.logger.info(`[KeyLifecycle] Importing identity for ${authUrn}`);

    // 1. Save Private Keys to local secure storage
    await this.crypto.storeMyKeys(authUrn, keys);

    // 2. We need to ensure the Public Keys are also cached.
    // Since 'keys' is just PrivateKeys (CryptoKey), we need to derive or fetch the public part.
    // The CryptoService should be able to derive them or we fetch from network.
    const publicBytes = await this.crypto.loadMyPublicKeys(authUrn);
    if (publicBytes) {
      await this.cache.storeKeys(authUrn, publicBytes);
    }
  }

  async checkIntegrity(urn: URN): Promise<boolean> {
    // 1. Get Local
    const localPub = await this.crypto.loadMyPublicKeys(urn);
    if (!localPub) return false;

    // 2. Get Remote
    const remotePub = await this.cache.getPublicKey(urn); // or getPublicKey
    if (!remotePub) return false; // or handle logic

    // 3. Domain Logic: Compare
    return this.keysAreEqual(localPub, remotePub);
  }

  private keysAreEqual(a: PublicKeys, b: PublicKeys): boolean {
    return (
      this.bytesEqual(a.encKey, b.encKey) && this.bytesEqual(a.sigKey, b.sigKey)
    );
  }

  private bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, i) => val === b[i]);
  }
}
