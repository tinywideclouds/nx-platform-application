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
import { KeyStorageService } from '@nx-platform-application/messenger-key-storage';
import { throwError } from 'rxjs';

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
      const ageMs = now.since(entryInstant, {
        largestUnit: 'milliseconds',
      }).milliseconds;

      if (ageMs < this.KEY_TTL_MS) {
        return deserializeJsonToPublicKeys(cachedEntry.keys);
      }
    }

    // 3. Fetch from network
    const newKeys = await this.secureKeyService.getKey(urn);
    if (!newKeys) {
      throw new Error(`Public key not found for URN: ${urn}`);
    }
    const newTimestamp = Temporal.Now.instant().toString() as ISODateTimeString;

    // 4. Store
    const serializableKeys = serializePublicKeysToJson(newKeys);
    await this.keyStorage.storeKey(keyUrn, serializableKeys, newTimestamp);

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
   * Uploads public keys to the backend via the SecureKeyService.
   * Used during key generation and handle claiming.
   */
  public async storeKeys(urn: URN, keys: PublicKeys): Promise<void> {
    await this.secureKeyService.storeKeys(urn, keys);

    // Optional: We could also cache them locally immediately to avoid a round-trip read later.
    const serializableKeys = serializePublicKeysToJson(keys);
    const timestamp = Temporal.Now.instant().toString() as ISODateTimeString;
    await this.keyStorage.storeKey(urn.toString(), serializableKeys, timestamp);
  }
  /**
   * Wipes the public key cache.
   * Used on Logout.
   */
  public async clear(): Promise<void> {
    await this.keyStorage.clearDatabase();
  }
}
