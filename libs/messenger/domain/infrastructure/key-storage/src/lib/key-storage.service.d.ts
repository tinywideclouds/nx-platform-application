import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { PublicKeyRecord } from './key-storage.models';
import * as i0 from "@angular/core";
/**
 * Service responsible for the persistent storage of Public Keys.
 * Acts as a wrapper around the IndexedDB 'publicKeys' table.
 */
export declare class KeyStorageService {
    private readonly db;
    /**
     * Caches a public key record.
     * @param urn The URN of the entity (user/device).
     * @param keys The key set (serialized).
     * @param timestamp The fetch timestamp for TTL calculations.
     */
    storeKey(urn: string, keys: Record<string, string>, timestamp: ISODateTimeString): Promise<void>;
    /**
     * Retrieves a cached public key record by URN.
     * @returns The record if found, or null.
     */
    getKey(urn: string): Promise<PublicKeyRecord | null>;
    /**
     * Wipes the public key cache.
     * Used on Logout to ensure clean state for the next user.
     */
    clearDatabase(): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<KeyStorageService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<KeyStorageService>;
}
