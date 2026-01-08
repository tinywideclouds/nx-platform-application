import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import { JwkRecord } from './models';
import { WebKeyStorageProvider } from './interfaces';
import * as i0 from "@angular/core";
export declare class WebKeyDbStore extends PlatformDexieService implements WebKeyStorageProvider {
    /**
     * A generic table for storing JsonWebKeys.
     */
    jwks: Table<JwkRecord, string>;
    constructor();
    saveJwk(id: string, key: JsonWebKey): Promise<void>;
    loadJwk(id: string): Promise<JsonWebKey | null>;
    deleteJwk(id: string): Promise<void>;
    clearDatabase(): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<WebKeyDbStore, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<WebKeyDbStore>;
}
