// --- FILE: libs/platform/ng/storage/src/lib/indexed-db.service.ts ---
// (FULL CODE)

import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { JwkRecord } from './models';
import { WebKeyStorageProvider } from './interfaces';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';

@Injectable({ providedIn: 'root' })
export class WebKeyDbStore extends PlatformDexieService implements WebKeyStorageProvider {
  /**
   * A generic table for storing JsonWebKeys.
   */
  private jwks!: Table<JwkRecord, string>;

  constructor() {
    super();

    this.version(2).stores({
      jwks: 'id', // The new generic table
      appStates: 'id', // This one remains
      keyPairs: null, // This deletes the old table
    });

    this.jwks = this.table('jwks');
  }

  // --- "Dumb" JWK-Specific Methods ---

  /**
   * Saves a single JsonWebKey by its ID.
   * @param id A unique ID for this key.
   * @param key The JsonWebKey to store.
   */
  async saveJwk(id: string, key: JsonWebKey): Promise<void> {
    await this.jwks.put({ id, key });
  }

  /**
   * Loads a single JsonWebKey by its ID.
   * @param id The unique ID of the key to load.
   */
  async loadJwk(id: string): Promise<JsonWebKey | null> {
    const record = await this.jwks.get(id);
    return record ? record.key : null;
  }

  /**
   * Deletes a single JsonWebKey by its ID.
   * @param id The unique ID of the key to delete.
   */
  async deleteJwk(id: string): Promise<void> {
    await this.jwks.delete(id);
  }
}
