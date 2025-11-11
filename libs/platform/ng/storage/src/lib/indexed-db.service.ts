// --- FILE: libs/platform/ng/storage/src/lib/indexed-db.service.ts ---
// (FULL CODE)

import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { JwkRecord } from './models';
import { StorageProvider } from "./interfaces"

@Injectable({ providedIn: 'root' })
export class IndexedDbStore extends Dexie implements StorageProvider {
  /**
   * A generic table for storing JsonWebKeys.
   */
  private jwks!: Table<JwkRecord, string>;

  constructor() {
    super('ActionIntentionDB');
    
    // We increment the version to 2 to introduce the new 'jwks' table
    // and remove the old 'keyPairs' table.
    this.version(1).stores({
      keyPairs: 'id',
      appStates: 'id',
    });
    
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