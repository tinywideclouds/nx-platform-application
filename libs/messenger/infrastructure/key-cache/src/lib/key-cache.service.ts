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
import { SecureKeyService } from '@nx-platform-application/messenger-infrastructure-key-access';
import { KeyStorageService } from '@nx-platform-application/messenger-infrastructure-key-storage';

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

    // 1. Check persistent cache
    const cachedEntry = await this.keyStorage.getKey(keyUrn);

    // 2. Check if it's "fresh"
    if (cachedEntry) {
      const now = Temporal.Now.instant();
      const entryInstant = Temporal.Instant.from(cachedEntry.timestamp);
      const ageMs = now.since(entryInstant, {
        largestUnit: 'milliseconds',
      }).milliseconds;

      if (ageMs < this.KEY_TTL_MS) {
        return deserializeJsonToPublicKeys(cachedEntry.keys);
      }
    }

    // 3. Fetch from network
    // ✅ REFACTORED: No manual null check.
    // If status is 204, this throws KeyNotFoundError.
    // If status is 404/500, this throws HttpError.
    const newKeys = await this.secureKeyService.getKey(urn);

    const newTimestamp = Temporal.Now.instant().toString() as ISODateTimeString;

    // 4. Store
    const serializableKeys = serializePublicKeysToJson(newKeys);
    await this.keyStorage.storeKey(keyUrn, serializableKeys, newTimestamp);

    return newKeys;
  }

  public async hasKeys(urn: URN): Promise<boolean> {
    try {
      // ✅ Works for both 204 (KeyNotFoundError) and 404 (HttpError)
      await this.getPublicKey(urn);
      return true;
    } catch (error) {
      return false;
    }
  }

  public async storeKeys(urn: URN, keys: PublicKeys): Promise<void> {
    await this.secureKeyService.storeKeys(urn, keys);
    const serializableKeys = serializePublicKeysToJson(keys);
    const timestamp = Temporal.Now.instant().toString() as ISODateTimeString;
    await this.keyStorage.storeKey(urn.toString(), serializableKeys, timestamp);
  }

  public async clear(): Promise<void> {
    await this.keyStorage.clearDatabase();
  }
}
