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
import { ChatStorageService } from '@nx-platform-application/chat-storage';

@Injectable({
  providedIn: 'root',
})
export class KeyCacheService {
  private secureKeyService = inject(SecureKeyService);
  private chatStorageService = inject(ChatStorageService);

  private readonly hours = 16;
  private readonly KEY_TTL_MS = this.hours * 60 * 60 * 1000;

  public async getPublicKey(urn: URN): Promise<PublicKeys> {
    const keyUrn = urn.toString();

    // 1. Check persistent cache
    const cachedEntry = await this.chatStorageService.getKey(keyUrn);

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
      await this.chatStorageService.storeKey(
        keyUrn,
        serializableKeys,
        newTimestamp
      );
    }

    return newKeys;
  }

  /**
   * Checks if public keys exist for a user without throwing an error.
   * Useful for UI status checks (e.g., enabling/disabling send button).
   */
  public async hasKeys(urn: URN): Promise<boolean> {
    try {
      // We reuse getPublicKey because it handles the caching logic perfectly.
      // If it returns keys (from cache or network), we are good.
      const keys = await this.getPublicKey(urn);
      return !!keys;
    } catch (error) {
      // 404 or Network Error means keys are missing/inaccessible
      return false;
    }
  }
}