import { URN, PublicKeys } from '@nx-platform-application/platform-types';
import * as i0 from "@angular/core";
export declare class KeyCacheService {
    private readonly secureKeyService;
    private readonly keyStorage;
    private readonly KEY_TTL_HOURS;
    private readonly KEY_TTL_MS;
    getPublicKey(urn: URN): Promise<PublicKeys>;
    hasKeys(urn: URN): Promise<boolean>;
    storeKeys(urn: URN, keys: PublicKeys): Promise<void>;
    clear(): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<KeyCacheService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<KeyCacheService>;
}
