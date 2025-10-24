import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { URN } from '@nx-platform-application/platform-types';
import { firstValueFrom, map } from 'rxjs';
import { PublicKeys } from './public-keys.model';

@Injectable({
  providedIn: 'root',
})
export class KeyService {
  private http = inject(HttpClient);

  /**
   * The cache stores the "nice" PublicKeys object.
   */
  private keyCache = new Map<string, PublicKeys>();

  /**
   * Fetches the key blob from the dumb store and "upgrades" it
   * to the smart PublicKeys interface.
   */
  public async getKey(userId: URN): Promise<PublicKeys> {
    const userUrnString = userId.toString();

    // 1. Check cache first for the "nice" object
    if (this.keyCache.has(userUrnString)) {
      return this.keyCache.get(userUrnString)!;
    }

    // 2. Fetch the raw blob (which is *just* the encKey)
    const url = `/api/keys/${userId}`;
    const rawEncKey = await firstValueFrom(
      this.http.get(url, { responseType: 'arraybuffer' })
        .pipe(
          map(buffer => new Uint8Array(buffer))
        )
    );

    // 3. "Lie" and wrap the raw key in the "nice" object
    const keys: PublicKeys = {
      encKey: rawEncKey,
      sigKey: new Uint8Array(), // Always empty for now
    };

    // 4. Cache and return the "nice" object
    this.keyCache.set(userUrnString, keys);
    return keys;
  }

  /**
   * "Downgrades" the smart PublicKeys interface to the raw
   * blob that the dumb store expects.
   */
  public async setKey(userId: URN, keys: PublicKeys): Promise<void> {
    const userUrnString = userId.toString();
    const url = `/api/keys/${userId}`;

    // 1. "Lie": Ignore the sigKey and just grab the encKey
    const rawEncKeyBlob = keys.encKey;

    // 2. POST *only* the raw encKey blob
    await firstValueFrom(
      this.http.post<void>(url, rawEncKeyBlob.buffer, {
        headers: { 'Content-Type': 'application/octet-stream' }
      })
    );

    // 3. On success, update the cache with the "nice" object
    //    (Note: we cache the object we were given, which may have
    //    an empty sigKey)
    this.keyCache.set(userUrnString, keys);
  }
}
