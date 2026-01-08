import { Contact, PendingIdentity, BlockedIdentity } from '@nx-platform-application/contacts-types';
import { StorableContact, StorablePendingIdentity, StorableBlockedIdentity } from '../records/contact.record';
import * as i0 from "@angular/core";
export declare class ContactMapper {
    toDomain(c: StorableContact): Contact;
    toStorable(c: Contact): StorableContact;
    toPendingDomain(p: StorablePendingIdentity): PendingIdentity;
    toBlockedDomain(b: StorableBlockedIdentity): BlockedIdentity;
    static ɵfac: i0.ɵɵFactoryDeclaration<ContactMapper, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ContactMapper>;
}
