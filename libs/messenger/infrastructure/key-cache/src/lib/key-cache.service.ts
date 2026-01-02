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
  private readonly secureKeyService = inject(SecureKeyService);
  private readonly keyStorage = inject(KeyStorageService);

  private readonly KEY_TTL_HOURS = 16;
  private readonly KEY_TTL_MS = this.KEY_TTL_HOURS * 60 * 60 * 1000;

  public async getPublicKey(urn: URN): Promise<PublicKeys> {
    const keyUrn = urn.toString();
    const cachedEntry = await this.keyStorage.getKey(keyUrn);

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

    const newKeys = await this.secureKeyService.getKey(urn);
    const newTimestamp = Temporal.Now.instant().toString() as ISODateTimeString;
    const serializableKeys = serializePublicKeysToJson(newKeys);

    await this.keyStorage.storeKey(keyUrn, serializableKeys, newTimestamp);

    return newKeys;
  }

  public async hasKeys(urn: URN): Promise<boolean> {
    try {
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
