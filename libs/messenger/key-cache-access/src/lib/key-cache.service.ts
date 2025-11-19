// libs/messenger/key-cache-access/src/lib/key-cache.service.ts

import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  PublicKeys,
  deserializeJsonToPublicKeys,
  serializePublicKeysToJson,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { SecureKeyService } from '@nx-platform-application/messenger-key-access';
// FIX: Inject the new KeyStorageService instead of ChatStorageService
import { KeyStorageService } from '@nx-platform-application/messenger-key-storage';

@Injectable({
  providedIn: 'root',
})
export class KeyCacheService {
  private secureKeyService = inject(SecureKeyService);
  private keyStorage = inject(KeyStorageService);

  private readonly hours = 16;
  private readonly KEY_TTL_MS = this.hours * 60 * 60 * 1000;

  public async getPublicKey(urn: URN): Promise<PublicKeys> {
    const keyUrn = urn.toString();

    // 1. Check persistent cache (using new service)
    const cachedEntry = await this.keyStorage.getKey(keyUrn);

    // 2. Check if it's "fresh"
    if (cachedEntry) {
      const now = Temporal.Now.instant();
      const entryInstant = Temporal.Instant.from(cachedEntry.timestamp);
      const ageMs = now.since(entryInstant, { largestUnit: 'milliseconds' }).milliseconds;

      if (ageMs < this.KEY_TTL_MS) {
        return deserializeJsonToPublicKeys(cachedEntry.keys);
      }
    }

    // 3. Fetch from network
    const newKeys: PublicKeys = await this.secureKeyService.getKey(urn);
    const newTimestamp = Temporal.Now.instant().toString() as ISODateTimeString;

    // 4. Store
    if (newKeys) {
      const serializableKeys = serializePublicKeysToJson(newKeys);
      await this.keyStorage.storeKey(
        keyUrn,
        serializableKeys,
        newTimestamp
      );
    }

    return newKeys;
  }

  public async hasKeys(urn: URN): Promise<boolean> {
    try {
      const keys = await this.getPublicKey(urn);
      return !!keys;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wipes the public key cache.
   * Used on Logout.
   */
  public async clear(): Promise<void> {
    await this.keyStorage.clearDatabase();
  }
}