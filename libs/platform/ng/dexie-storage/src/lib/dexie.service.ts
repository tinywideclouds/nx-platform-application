// --- FILE: libs/platform-dexie-storage/src/lib/platform-dexie.store.ts ---

import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';

/**
 * A simple record for storing basic key-value state.
 * This is just a minimal table for version 1.
 */
export interface AppStateRecord {
  id: string;
  value: string;
}

export interface DexieStorageProvider {
    setVersion(value: string): Promise<void>;
}

@Injectable({
  providedIn: 'root',
})
export class PlatformDexieService extends Dexie implements DexieStorageProvider {
  /**
   * A generic table for storing app-wide state.
   */
  private appState!: Table<AppStateRecord, string>;

  constructor() {
    // 1. Define the database name. This will be shared
    //    by all services that extend this class.
    super('ActionIntentionDB');

    // 2. Define the *base* schema (Version 1).
    this.version(1).stores({
      appState: '&id',
    });

    // 3. Initialize the table property
    this.appState = this.table('appState');
  }

  /**
   * Saves a simple key-value state.
   * This is just a basic method to make the service testable.
   */
  async setVersion(value: string): Promise<void> {
    await this.appState.put({ id: 'version', value });
  }
}