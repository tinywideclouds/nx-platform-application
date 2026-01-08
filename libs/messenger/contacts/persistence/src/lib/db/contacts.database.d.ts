import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import { ContactTombstone } from '@nx-platform-application/contacts-types';
import { StorableContact, StorableIdentityLink, StorablePendingIdentity, StorableBlockedIdentity } from '../records/contact.record';
import { StorableGroup } from '../records/group.record';
import * as i0 from "@angular/core";
export declare class ContactsDatabase extends PlatformDexieService {
    contacts: Table<StorableContact, string>;
    groups: Table<StorableGroup, string>;
    links: Table<StorableIdentityLink, number>;
    pending: Table<StorablePendingIdentity, number>;
    blocked: Table<StorableBlockedIdentity, number>;
    tombstones: Table<ContactTombstone, string>;
    constructor();
    static ɵfac: i0.ɵɵFactoryDeclaration<ContactsDatabase, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ContactsDatabase>;
}
