// libs/messenger/messenger-key-access/src/lib/key-service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  URN,
  PublicKeys,
  deserializeJsonToPublicKeys,
  serializePublicKeysToJson,
} from '@nx-platform-application/platform-types';
import { KEY_SERVICE_URL } from './key-access.config';
import { Logger } from '@nx-platform-application/console-logger';

/**
 * App-specific KeyService for the "Sealed Sender" model.
 *
 * This service handles the Read (GET) and Write (POST) operations 
 * for a user's public keys against the /api/keys/{urn} endpoint.
 */
@Injectable({
  providedIn: 'root',
})
export class SecureKeyService {
  private http = inject(HttpClient);
  private logger = inject(Logger);
  private keyCache = new Map<string, PublicKeys>();

  // Defaults to 'api/keys' (handled by proxy in production)
  private readonly baseApiUrl =
    inject(KEY_SERVICE_URL, { optional: true }) ?? 'api/keys';

  /**
   * (Read)
   * Fetches public keys for a user, using a local cache.
   * Returns null if the user has not uploaded keys (404).
   */
  public async getKey(userId: URN): Promise<PublicKeys | null> {
    const userUrnString = userId.toString();

    if (this.keyCache.has(userUrnString)) {
      return this.keyCache.get(userUrnString)!;
    }

    const url = this.buildUrl(userUrnString);

    try {
      // We expect 'unknown' because we pass it to a deserializer
      const jsonResponse = await firstValueFrom(this.http.get<unknown>(url));
      
      const keys = deserializeJsonToPublicKeys(jsonResponse);

      this.keyCache.set(userUrnString, keys);
      return keys;

    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.logger.debug(`[SecureKeyService] No keys found for ${userUrnString} (404)`);
        // We do not cache the 'null' result here, allowing retries later.
        return null;
      }
      
      // Re-throw unexpected errors (500, Network, etc.)
      this.logger.error(`[SecureKeyService] Error fetching keys for ${userUrnString}`, error);
      throw error;
    }
  }

  /**
   * (Write)
   * Uploads a user's public keys to the key service.
   * Clears the local cache for that user on success.
   */
  public async storeKeys(userUrn: URN, keys: PublicKeys): Promise<void> {
    const userUrnString = userUrn.toString();
    const url = this.buildUrl(userUrnString);

    this.logger.debug(`[SecureKeyService] POSTing keys to ${url}`);
    const payload = serializePublicKeysToJson(keys);

    await firstValueFrom(this.http.post<void>(url, payload));
    
    this.logger.debug(`[SecureKeyService] Key upload successful`);

    this.keyCache.delete(userUrnString);
  }

  public clearCache(): void {
    this.keyCache.clear();
  }

  private buildUrl(userUrnString: string): string {
    return `${this.baseApiUrl}/${userUrnString}`;
  }
}