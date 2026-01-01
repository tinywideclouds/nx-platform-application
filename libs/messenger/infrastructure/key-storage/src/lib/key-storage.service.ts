import { Injectable, inject } from '@angular/core';
import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { PublicKeyRecord } from './key-storage.models';
import { KeyDatabase } from './db/key.database';

/**
 * Service responsible for the persistent storage of Public Keys.
 * Acts as a wrapper around the IndexedDB 'publicKeys' table.
 */
@Injectable({
  providedIn: 'root',
})
export class KeyStorageService {
  private readonly db = inject(KeyDatabase);

  /**
   * Caches a public key record.
   * @param urn The URN of the entity (user/device).
   * @param keys The key set (serialized).
   * @param timestamp The fetch timestamp for TTL calculations.
   */
  async storeKey(
    urn: string,
    keys: Record<string, string>,
    timestamp: ISODateTimeString,
  ): Promise<void> {
    const record: PublicKeyRecord = { urn, keys, timestamp };
    await this.db.publicKeys.put(record);
  }

  /**
   * Retrieves a cached public key record by URN.
   * @returns The record if found, or null.
   */
  async getKey(urn: string): Promise<PublicKeyRecord | null> {
    const record = await this.db.publicKeys.get(urn);
    return record || null;
  }

  /**
   * Wipes the public key cache.
   * Used on Logout to ensure clean state for the next user.
   */
  async clearDatabase(): Promise<void> {
    await this.db.publicKeys.clear();
  }
}
