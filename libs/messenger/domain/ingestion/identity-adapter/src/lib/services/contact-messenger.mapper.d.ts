import { URN } from '@nx-platform-application/platform-types';
import { IdentityResolver } from '../interfaces/identity-resolver.interface';
import * as i0 from "@angular/core";
export declare class ContactMessengerMapper implements IdentityResolver {
    private logger;
    private contactsService;
    private authService;
    resolveToHandle(urn: URN): Promise<URN>;
    resolveToContact(handle: URN): Promise<URN>;
    getStorageUrn(urn: URN): Promise<URN>;
    private isHandle;
    static ɵfac: i0.ɵɵFactoryDeclaration<ContactMessengerMapper, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ContactMessengerMapper>;
}
