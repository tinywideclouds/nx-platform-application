// --- File: libs/messenger/key-v2-access/src/key-service.ts ---

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// --- PLATFORM IMPORTS (Smart Types and Mappers) ---
import {
  URN,
  PublicKeys,
  deserializeJsonToPublicKeys,
  serializePublicKeysToJson, // <-- ADDED
} from '@nx-platform-application/platform-types';
import { KEY_SERVICE_URL } from './key-access.config';

/**
 * App-specific KeyService for the "Sealed Sender" model.
 *
 * This service is clean. It knows nothing about Protobuf.
 * It fetches JSON from the new v2 endpoint and uses the
 * platform-provided deserializer to get a "smart" PublicKeys object.
 *
 * It also handles writing/uploading public keys to the v2 endpoint.
 */
@Injectable({
  providedIn: 'root',
})
export class SecureKeyService {
  private http = inject(HttpClient);
  private keyCache = new Map<string, PublicKeys>();

  private readonly baseApiUrl = inject(KEY_SERVICE_URL, {optional: true}) ?? 'api/v2/keys';
  /**
   * (Read)
   * Fetches public keys for a user, using a local cache.
   */
  public async getKey(userId: URN): Promise<PublicKeys> {
    const userUrnString = userId.toString();

    // 1. Check cache
    if (this.keyCache.has(userUrnString)) {
      return this.keyCache.get(userUrnString)!;
    }

    // 2. Fetch JSON from the new v2 endpoint
    const url = this.buildUrl(userUrnString);
    const jsonResponse = await firstValueFrom(this.http.get<unknown>(url));

    // 3. Deserialize using the platform-types mapper
    const keys = deserializeJsonToPublicKeys(jsonResponse);

    // 4. Populate cache and return
    this.keyCache.set(userUrnString, keys);
    return keys;
  }

  /**
   * (Write)
   * Uploads a user's public keys to the v2 key service.
   * Clears the local cache for that user on success.
   */
  public async storeKeys(userUrn: URN, keys: PublicKeys): Promise<void> {
    const userUrnString = userUrn.toString();
    const url = this.buildUrl(userUrnString);

    // 1. Serialize keys to JSON-safe object
    const payload = serializePublicKeysToJson(keys);

    // 2. POST to the endpoint
    await firstValueFrom(this.http.post<void>(url, payload));

    // 3. Clear cache on success
    this.keyCache.delete(userUrnString);
  }

  /**
   * Clears the entire key cache.
   */
  public clearCache(): void {
    this.keyCache.clear();
  }

  private buildUrl(userUrnString: string): string {
    return `${this.baseApiUrl}/${userUrnString}`;
  }
}
