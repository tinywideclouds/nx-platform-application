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
export declare abstract class PlatformDexieService extends Dexie implements DexieStorageProvider {
    appState: Table<AppStateRecord, string>;
    protected constructor(dbName: string);
    setVersion(value: string): Promise<void>;
}
