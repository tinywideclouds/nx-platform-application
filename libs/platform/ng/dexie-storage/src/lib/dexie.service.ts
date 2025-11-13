import { Dexie, Table } from 'dexie';

export interface AppStateRecord {
  id: string;
  value: string;
}

export interface DexieStorageProvider {
    setVersion(value: string): Promise<void>;
}

/**
 * Abstract Base Class.
 * Provides shared configuration but requires the child class to specify the Database Name.
 */
export abstract class PlatformDexieService extends Dexie implements DexieStorageProvider {
  appState!: Table<AppStateRecord, string>;

  protected constructor(dbName: string) {
    super(dbName);

    // Define the base schema (Version 1)
    this.version(1).stores({
      appState: '&id',
    });

    this.appState = this.table('appState');
  }

  async setVersion(value: string): Promise<void> {
    await this.appState.put({ id: 'version', value });
  }
}