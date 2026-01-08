import { URN } from '@nx-platform-application/platform-types';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import * as i0 from "@angular/core";
export declare class ChatKeyService {
    private logger;
    private keyService;
    private cryptoService;
    private identityResolver;
    /**
     * Checks if valid public keys exist for a recipient.
     * Handles identity resolution automatically via the Adapter.
     */
    checkRecipientKeys(urn: URN): Promise<boolean>;
    resetIdentityKeys(userUrn: URN, userEmail?: string): Promise<PrivateKeys>;
    static ɵfac: i0.ɵɵFactoryDeclaration<ChatKeyService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ChatKeyService>;
}
