import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { ContactsStorageService } from '@nx-platform-application/contacts-infrastructure-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Injectable({ providedIn: 'root' })
export class ContactsDomainService {
  // Infrastructure Dependencies
  readonly localStore = inject(ContactsStorageService);
  private logger = inject(Logger);

  // ======================================================
  // 📡 READ STREAMS (Passthrough)
  // ======================================================

  readonly contacts$ = this.localStore.contacts$;
  readonly groups$ = this.localStore.groups$;
  readonly links$ = this.localStore.links$;

  // ======================================================
  // 👥 CONTACT GROUPS
  // ======================================================

  /**
   * Creates a purely local group of Contacts.
   * @param memberUrns Must be 'urn:contacts:user:*'
   */
  async createGroup(
    name: string,
    description: string,
    memberUrns: URN[],
  ): Promise<URN> {
    const localId = URN.parse(`urn:contacts:group:${crypto.randomUUID()}`);
    const now = Temporal.Now.instant().toString() as ISODateTimeString;

    this.logger.info(`[ContactsDomain] Creating Local Group: ${name}`);

    await this.localStore.saveGroup({
      id: localId,
      // directoryId: undefined, // Explicitly undefined
      name,
      description,
      memberUrns,
      lastModified: now,
    });

    return localId;
  }

  /**
   * Updates an existing group.
   * ✅ RESTORED: Required by UI for editing.
   */
  async saveGroup(group: ContactGroup): Promise<void> {
    const updated = {
      ...group,
      lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
    };
    return this.localStore.saveGroup(updated);
  }

  async getGroup(id: URN): Promise<ContactGroup | undefined> {
    return this.localStore.getGroup(id);
  }

  async deleteGroup(id: URN): Promise<void> {
    return this.localStore.deleteGroup(id);
  }

  /**
   * Retrieves subgroups.
   * ✅ RESTORED: Required by UI hierarchy logic.
   */
  async getGroupsByParent(parentId: URN): Promise<ContactGroup[]> {
    return this.localStore.getGroupsByParent(parentId);
  }

  async getGroupsForContact(contactUrn: URN): Promise<ContactGroup[]> {
    return this.localStore.getGroupsForContact(contactUrn);
  }

  async getGroupMetadata(urn: URN): Promise<{ memberCount: number }> {
    const group = await this.localStore.getGroup(urn);
    return { memberCount: group ? group.memberUrns.length : 0 };
  }

  // ======================================================
  // 👤 CONTACTS
  // ======================================================

  async createContact(
    alias: string,
    linkedIdentity?: { urn: URN; scope: string },
  ): Promise<URN> {
    const localId = URN.parse(`urn:contacts:user:${crypto.randomUUID()}`);
    const now = Temporal.Now.instant().toString() as ISODateTimeString;

    const newContact: Contact = {
      id: localId,
      alias,
      firstName: alias,
      surname: '',
      email: '',
      emailAddresses: [],
      phoneNumbers: [],
      serviceContacts: {},
      lastModified: now,
    };

    // 1. Save Contact
    await this.localStore.saveContact(newContact);

    // 2. Link Identity (if provided)
    if (linkedIdentity) {
      await this.localStore.linkIdentityToContact(
        localId,
        linkedIdentity.urn,
        linkedIdentity.scope,
      );
    }

    return localId;
  }

  async saveContact(contact: Contact): Promise<void> {
    await this.localStore.saveContact(contact);
  }

  async deleteContact(id: URN): Promise<void> {
    await this.localStore.deleteContact(id);
  }

  async getContact(urn: URN): Promise<Contact | undefined> {
    return this.localStore.getContact(urn);
  }

  async getLinkedIdentities(urn: URN): Promise<URN[]> {
    return this.localStore.getLinkedIdentities(urn);
  }

  async clearDatabase(): Promise<void> {
    return this.localStore.clearDatabase();
  }
}
