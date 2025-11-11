// --- FILE: libs/messenger/key-cache-access/src/lib/key-cache.service.ts ---
// (NEW FILE)

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

/**
 * A "repository" service that provides a persistent, TTL-based
 * cache for user public keys.
 *
 * It orchestrates fetching from the network (via SecureKeyService)
 * and caching in IndexedDB (via ChatStorageService).
 *
 * The ChatService should inject THIS service, not SecureKeyService directly.
 */
@Injectable({
  providedIn: 'root',
})
export class KeyCacheService {
  // --- Dependencies ---
  private secureKeyService = inject(SecureKeyService);
  private chatStorageService = inject(ChatStorageService);

  // Set a Time-To-Live (TTL) for keys, e.g., 16 or 24 hours
  private readonly hours = 16;
  private readonly KEY_TTL_MS = this.hours * 60 * 60 * 1000;

  /**
   * Gets a user's public keys, using a persistent cache.
   *
   * 1. Checks IndexedDB for a "fresh" key.
   * 2. If not found or expired, fetches from the network.
   * 3. Stores the newly fetched key in IndexedDB.
   */
  public async getPublicKey(urn: URN): Promise<PublicKeys> {
    const keyUrn = urn.toString();

    // 1. Check persistent cache
    const cachedEntry = await this.chatStorageService.getKey(keyUrn);

    // 2. Check if it's "fresh" (using Temporal)
    if (cachedEntry) {
      const now = Temporal.Now.instant();
      const entryInstant = Temporal.Instant.from(cachedEntry.timestamp);
      
      // Calculate age in milliseconds
      const ageMs = now.since(entryInstant, { largestUnit: 'milliseconds' }).milliseconds;

      if (ageMs < this.KEY_TTL_MS) {
        // Cache is fresh. Deserialize and return.
        return deserializeJsonToPublicKeys(cachedEntry.keys);
      }
    }

    // 3. Not in cache or expired: Fetch from network
    // (This uses SecureKeyService, which has its own L1 in-memory cache)
    const newKeys: PublicKeys = await this.secureKeyService.getKey(urn);

    // Get a new ISO timestamp from Temporal
    const newTimestamp = Temporal.Now.instant().toString() as ISODateTimeString;
    // 4. Store in persistent cache
    if (newKeys) {
      // Serialize (PublicKeys -> JSON) before storing
      const serializableKeys = serializePublicKeysToJson(newKeys);
      await this.chatStorageService.storeKey(
        keyUrn,
        serializableKeys,
        newTimestamp
      );
    }

    return newKeys;
  }
}