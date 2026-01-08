import { URN, PublicKeys } from '@nx-platform-application/platform-types';
import * as i0 from "@angular/core";
export declare class SecureKeyService {
    private readonly http;
    private readonly logger;
    private readonly keyCache;
    private readonly baseApiUrl;
    getKey(userId: URN): Promise<PublicKeys>;
    storeKeys(userUrn: URN, keys: PublicKeys): Promise<void>;
    clearCache(): void;
    private buildUrl;
    static ɵfac: i0.ɵɵFactoryDeclaration<SecureKeyService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<SecureKeyService>;
}
