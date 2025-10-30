// --- File: libs/messenger/data-access/secure-key.service.ts ---

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// --- PLATFORM IMPORTS (Smart Types and Deserializers ONLY) ---
import {
  URN,
  PublicKeys,
  deserializeJsonToPublicKeys, // <-- The *only* function we need
} from '@nx-platform-application/platform-types'; // Assumed path

/**
 * App-specific KeyService for the "Sealed Sender" model.
 *
 * This service is clean. It knows nothing about Protobuf.
 * It fetches JSON from the new v2 endpoint and uses the
 * platform-provided deserializer to get a "smart" PublicKeys object.
 */
@Injectable({
  providedIn: 'root',
})
export class SecureKeyService {
  private http = inject(HttpClient);
  private keyCache = new Map<string, PublicKeys>();

  public async getKey(userId: URN): Promise<PublicKeys> {
    const userUrnString = userId.toString();

    // 1. Check cache
    if (this.keyCache.has(userUrnString)) {
      return this.keyCache.get(userUrnString)!;
    }

    // 2. Fetch JSON from the new v2 endpoint
    // (No 'responseType: arraybuffer'. Default is JSON.)
    const url = `/api/v2/keys/${userId}`;
    const jsonResponse = await firstValueFrom(this.http.get<any>(url));

    // 3. Use the platform deserializer.
    // (This service has ZERO knowledge of Protobuf)
    const keys = deserializeJsonToPublicKeys(jsonResponse);

    // 4. Cache and return the "smart" object
    this.keyCache.set(userUrnString, keys);
    return keys;
  }
}
