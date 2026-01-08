import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import { PublicKeyRecord } from '../key-storage.models';
import * as i0 from "@angular/core";
/**
 * IndexedDB wrapper for storing public keys.
 * Extends the platform Dexie service for consistent configuration.
 */
export declare class KeyDatabase extends PlatformDexieService {
    publicKeys: Table<PublicKeyRecord, string>;
    constructor();
    static ɵfac: i0.ɵɵFactoryDeclaration<KeyDatabase, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<KeyDatabase>;
}
