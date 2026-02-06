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
   * 1. Calls CryptoService to generate KeyPairs.
   * 2. Publishes Public Keys to the Cache/Network for the Auth URN.
   * 3. (Optional) Publishes Public Keys for a Network Alias (e.g., Email URN).
   * 4. Returns Private Keys.
   */
  async createIdentity(authUrn: URN, networkUrn?: URN): Promise<WebCryptoKeys> {
    this.logger.info(`[KeyLifecycle] Creating new identity for ${authUrn}`);

    // 1. Generate via Crypto Bridge
    const generated = await this.crypto.generateAndStoreKeys(authUrn);

    // 2. Publish PUBLIC keys for the Auth Identity
    await this.cache.storeKeys(authUrn, generated.publicKeys);

    // 3. Publish for Network Alias (if different)
    if (networkUrn && !networkUrn.equals(authUrn)) {
      this.logger.info(
        `[KeyLifecycle] Publishing alias keys for ${networkUrn}`,
      );
      await this.cache.storeKeys(networkUrn, generated.publicKeys);
    }

    // 4. Return PRIVATE keys
    return generated.privateKeys;
  }

  /**
   * Domain Action: Flush the local knowledge of the network.
   * Used when keys seem stale or during debugging.
   */
  async clearCache(): Promise<void> {
    this.logger.warn('[KeyLifecycle] Clearing Public Key Cache');
    await this.cache.clear();
  }

  /**
   * Restores identity from local storage.
   * Checks if Public Keys are missing from the cache and repairs them if needed.
   */
  async restoreIdentity(authUrn: URN): Promise<WebCryptoKeys | null> {
    // 1. Load Private Keys
    const privateKeys = await this.crypto.loadMyKeys(authUrn);
    if (!privateKeys) return null;

    // 2. Self-Healing
    try {
      const hasPublic = await this.cache.hasKeys(authUrn);
      if (!hasPublic) {
        this.logger.warn(
          '[KeyLifecycle] Public keys missing from cache. Repairing...',
        );
        const publicBytes = await this.crypto.loadMyPublicKeys(authUrn);
        if (publicBytes) {
          await this.cache.storeKeys(authUrn, publicBytes);
        }
      }
    } catch (e) {
      this.logger.error('[KeyLifecycle] Restore consistency check failed', e);
    }

    return privateKeys;
  }

  /**
   * Imports an identity (e.g. from Device Linking).
   */
  async importIdentity(authUrn: URN, keys: WebCryptoKeys): Promise<void> {
    this.logger.info(`[KeyLifecycle] Importing identity for ${authUrn}`);

    // 1. Save Private Keys
    await this.crypto.storeMyKeys(authUrn, keys);

    // 2. Ensure Public Keys are cached
    const publicBytes = await this.crypto.loadMyPublicKeys(authUrn);
    if (publicBytes) {
      await this.cache.storeKeys(authUrn, publicBytes);
    }
  }

  async checkIntegrity(urn: URN): Promise<boolean> {
    const localPub = await this.crypto.loadMyPublicKeys(urn);
    if (!localPub) return false;

    const remotePub = await this.cache.getPublicKey(urn);
    if (!remotePub) return false;

    return this.keysAreEqual(localPub, remotePub);
  }

  async loadFingerprint(urn: URN): Promise<string> {
    if (!urn) return '';

    try {
      const keys = await this.crypto.loadMyPublicKeys(urn);
      if (keys?.encKey) {
        return await this.crypto.getFingerprint(keys.encKey);
      }
      return '';
    } catch (e) {
      this.logger.warn('error loading fingerprint', e);
      return '';
    }
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
