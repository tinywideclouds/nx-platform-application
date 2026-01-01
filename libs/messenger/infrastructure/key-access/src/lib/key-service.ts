import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';

// ✅ IMPORT: Now consuming the Domain Error, not defining it
import {
  URN,
  PublicKeys,
  deserializeJsonToPublicKeys,
  serializePublicKeysToJson,
  KeyNotFoundError,
} from '@nx-platform-application/platform-types';

import { KEY_SERVICE_URL } from './key-access.config';

@Injectable({
  providedIn: 'root',
})
export class SecureKeyService {
  private http = inject(HttpClient);
  private logger = inject(Logger);
  private keyCache = new Map<string, PublicKeys>();

  private readonly baseApiUrl =
    inject(KEY_SERVICE_URL, { optional: true }) ?? 'api/keys';

  public async getKey(userId: URN): Promise<PublicKeys> {
    const userUrnString = userId.toString();

    if (this.keyCache.has(userUrnString)) {
      return this.keyCache.get(userUrnString)!;
    }

    const url = this.buildUrl(userUrnString);

    try {
      const response = await firstValueFrom(
        this.http.get<unknown>(url, { observe: 'response' }),
      );

      // ✅ LOGIC: Explicitly Signal the Domain State
      if (response.status === 204) {
        this.logger.debug(
          `[SecureKeyService] 204 No Content for ${userUrnString}`,
        );
        throw new KeyNotFoundError(userUrnString);
      }

      const keys = deserializeJsonToPublicKeys(response.body);
      this.keyCache.set(userUrnString, keys);
      return keys;
    } catch (error: any) {
      if (error instanceof KeyNotFoundError) throw error;

      this.logger.error(`[SecureKeyService] Error fetching keys`, error);
      throw error;
    }
  }

  // ... (storeKeys, clearCache, buildUrl remain unchanged) ...
  public async storeKeys(userUrn: URN, keys: PublicKeys): Promise<void> {
    const userUrnString = userUrn.toString();
    const url = this.buildUrl(userUrnString);
    const payload = serializePublicKeysToJson(keys);
    await firstValueFrom(this.http.post<void>(url, payload));
    this.keyCache.delete(userUrnString);
  }

  public clearCache(): void {
    this.keyCache.clear();
  }

  private buildUrl(userUrnString: string): string {
    return `${this.baseApiUrl}/${userUrnString}`;
  }
}
