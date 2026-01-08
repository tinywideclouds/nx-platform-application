import { Observable } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { Contact, ContactGroup, IdentityLink, ContactTombstone } from '@nx-platform-application/contacts-types';
import * as i0 from "@angular/core";
/**
 * RESPONSIBILITY: Address Book & Local Data
 * Manages the User's Contacts and Groups.
 * Network-specific logic (Consensus, Gatekeeper) is broken out into separate services.
 */
export declare class ContactsStorageService {
    private readonly db;
    private readonly contactMapper;
    private readonly groupMapper;
    readonly contacts$: Observable<Contact[]>;
    readonly favorites$: Observable<Contact[]>;
    readonly groups$: Observable<ContactGroup[]>;
    saveContact(contact: Contact): Promise<void>;
    updateContact(id: URN, changes: Partial<Contact>): Promise<void>;
    getContact(id: URN): Promise<Contact | undefined>;
    deleteContact(id: URN): Promise<void>;
    findByEmail(email: string): Promise<Contact | undefined>;
    findByPhone(phone: string): Promise<Contact | undefined>;
    bulkUpsert(contacts: Contact[]): Promise<void>;
    saveGroup(group: ContactGroup): Promise<void>;
    getGroup(id: URN): Promise<ContactGroup | undefined>;
    getGroupsByScope(scope: 'local' | 'messenger'): Promise<ContactGroup[]>;
    getGroupsByParent(parentId: URN): Promise<ContactGroup[]>;
    deleteGroup(id: URN): Promise<void>;
    linkIdentityToContact(contactId: URN, authUrn: URN): Promise<void>;
    getLinkedIdentities(contactId: URN): Promise<URN[]>;
    getAllIdentityLinks(): Promise<IdentityLink[]>;
    findContactByAuthUrn(authUrn: URN): Promise<Contact | null>;
    getAllTombstones(): Promise<ContactTombstone[]>;
    getAllContacts(): Promise<Contact[]>;
    getAllGroups(): Promise<ContactGroup[]>;
    clearAllContacts(): Promise<void>;
    getGroupsForContact(contactId: URN): Promise<ContactGroup[]>;
    getContactsForGroup(groupId: URN): Promise<Contact[]>;
    clearDatabase(): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<ContactsStorageService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ContactsStorageService>;
}
