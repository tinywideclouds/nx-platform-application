import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import { JwkRecord } from './models';
import { WebKeyStorageProvider } from './interfaces';

@Injectable({ providedIn: 'root' })
export class WebKeyDbStore
  extends PlatformDexieService
  implements WebKeyStorageProvider
{
  /**
   * A generic table for storing JsonWebKeys.
   */
  jwks!: Table<JwkRecord, string>;

  constructor() {
    // 1. DOMAIN NAME: Platform
    // We explicitly name this database to separate it from Contacts and Messenger
    super('platform');

    // 2. SCHEMA
    // Version 1 is inherited from PlatformDexieService (appState)
    // Version 2 adds our specific tables
    this.version(2).stores({
      jwks: 'id',
      keyPairs: null, // Deletes the old table if it existed in previous iterations
    });

    this.jwks = this.table('jwks');
  }

  async saveJwk(id: string, key: JsonWebKey): Promise<void> {
    await this.jwks.put({ id, key });
  }

  async loadJwk(id: string): Promise<JsonWebKey | null> {
    const record = await this.jwks.get(id);
    return record ? record.key : null;
  }

  async deleteJwk(id: string): Promise<void> {
    await this.jwks.delete(id);
  }

  async clearDatabase(): Promise<void> {
    await this.jwks.clear();
  }
}
