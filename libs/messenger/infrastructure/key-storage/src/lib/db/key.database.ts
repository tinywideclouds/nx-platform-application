import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import { PublicKeyRecord } from '../key-storage.models';

/**
 * IndexedDB wrapper for storing public keys.
 * Extends the platform Dexie service for consistent configuration.
 */
@Injectable({ providedIn: 'root' })
export class KeyDatabase extends PlatformDexieService {
  publicKeys!: Table<PublicKeyRecord, string>;

  constructor() {
    // 1. DOMAIN NAME: messenger_keys
    // Separate DB ensures we can wipe keys without touching messages (and vice versa)
    super('messenger_keys');

    // 2. SCHEMA
    // &urn = Unique Primary Key
    this.version(1).stores({
      publicKeys: '&urn, timestamp',
    });

    this.publicKeys = this.table('publicKeys');
  }
}
