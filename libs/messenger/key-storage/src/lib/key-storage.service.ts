// libs/messenger/key-storage/src/lib/key-storage.service.ts

import { Injectable, inject } from '@angular/core';
import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { PublicKeyRecord } from './key-storage.models';
import { KeyDatabase } from './db/key.database';

@Injectable({
  providedIn: 'root',
})
export class KeyStorageService {
  private readonly db = inject(KeyDatabase);

  /**
   * Caches a public key record.
   */
  async storeKey(
    urn: string,
    keys: Record<string, string>,
    timestamp: ISODateTimeString
  ): Promise<void> {
    const record: PublicKeyRecord = { urn, keys, timestamp };
    await this.db.publicKeys.put(record);
  }

  /**
   * Retrieves a cached public key record by URN.
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