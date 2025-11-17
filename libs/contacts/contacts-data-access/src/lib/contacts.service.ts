// libs/contacts/contacts-data-access/src/lib/contacts.service.ts

import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { ContactsDatabase } from './db/contacts.database';
import {
  Contact,
  ContactGroup,
  StorableContact,
  StorableGroup,
  StorableServiceContact,
  ServiceContact,
  IdentityLink,
  StorableIdentityLink,
} from './models/contacts';
import { URN } from '@nx-platform-application/platform-types';

@Injectable({
  providedIn: 'root',
})
export class ContactsStorageService {
  private readonly db = inject(ContactsDatabase);

  // --- Mapper Functions ---

  // Maps from Storable (DB) to Domain (App)
  private mapStorableToContact(c: StorableContact): Contact {
    const serviceContacts: Record<string, ServiceContact> = {};
    if (c.serviceContacts) {
      for (const key in c.serviceContacts) {
        const s = c.serviceContacts[key];
        if (s) {
          serviceContacts[key] = {
            ...s,
            id: URN.parse(s.id),
          };
        }
      }
    }
    return {
      ...c,
      id: URN.parse(c.id),
      serviceContacts,
    };
  }

  // Maps from Domain (App) to Storable (DB)
  private mapContactToStorable(c: Contact): StorableContact {
    const serviceContacts: Record<string, StorableServiceContact> = {};
    if (c.serviceContacts) {
      for (const key in c.serviceContacts) {
        const s = c.serviceContacts[key];
        if (s) {
          serviceContacts[key] = {
            ...s,
            id: s.id.toString(),
          };
        }
      }
    }
    return {
      ...c,
      id: c.id.toString(),
      serviceContacts,
    };
  }

  // Maps from Storable (DB) to Domain (App)
  private mapStorableToGroup(g: StorableGroup): ContactGroup {
    return {
      ...g,
      id: URN.parse(g.id),
      contactIds: g.contactIds.map((id) => URN.parse(id)),
    };
  }

  // Maps from Domain (App) to Storable (DB)
  private mapGroupToStorable(g: ContactGroup): StorableGroup {
    return {
      ...g,
      id: g.id.toString(),
      contactIds: g.contactIds.map((id) => id.toString()),
    };
  }

  // --- LiveQuery Streams ---

  readonly contacts$: Observable<Contact[]> = from(
    liveQuery(() => this.db.contacts.orderBy('alias').toArray())
  ).pipe(map((storables) => storables.map(this.mapStorableToContact)));

  readonly favorites$: Observable<Contact[]> = from(
    liveQuery(() =>
      this.db.contacts.where('isFavorite').equals(true as any).toArray()
    )
  ).pipe(map((storables) => storables.map(this.mapStorableToContact)));

  readonly groups$: Observable<ContactGroup[]> = from(
    liveQuery(() => this.db.contactGroups.orderBy('name').toArray())
  ).pipe(map((storables) => storables.map(this.mapStorableToGroup)));

  // --- CRUD Methods ---

  async saveContact(contact: Contact): Promise<void> {
    const storable = this.mapContactToStorable(contact);
    await this.db.contacts.put(storable);
  }

  async updateContact(id: URN, changes: Partial<Contact>): Promise<void> {
    const {
      id: urnId,
      serviceContacts: domainServiceContacts,
      ...simpleChanges
    } = changes;

    const storableChanges: Partial<StorableContact> = {
      ...simpleChanges,
    };

    if (urnId) {
      storableChanges.id = urnId.toString();
    }

    if (domainServiceContacts) {
      const serviceContacts: Record<string, StorableServiceContact> = {};
      for (const key in domainServiceContacts) {
        const s = domainServiceContacts[key];
        if (s) {
          serviceContacts[key] = {
            ...s,
            id: s.id.toString(),
          };
        }
      }
      storableChanges.serviceContacts = serviceContacts;
    }

    await this.db.contacts.update(id.toString(), storableChanges);
  }

  async getContact(id: URN): Promise<Contact | undefined> {
    const storable = await this.db.contacts.get(id.toString());
    return storable ? this.mapStorableToContact(storable) : undefined;
  }

  async deleteContact(id: URN): Promise<void> {
    await this.db.contacts.delete(id.toString());
  }

  async findByEmail(email: string): Promise<Contact | undefined> {
    const storable = await this.db.contacts
      .where('emailAddresses')
      .equals(email)
      .first();
    return storable ? this.mapStorableToContact(storable) : undefined;
  }

  async findByPhone(phone: string): Promise<Contact | undefined> {
    const storable = await this.db.contacts
      .where('phoneNumbers')
      .equals(phone)
      .first();
    return storable ? this.mapStorableToContact(storable) : undefined;
  }

  async bulkUpsert(contacts: Contact[]): Promise<void> {
    const storables = contacts.map(this.mapContactToStorable);
    await this.db.transaction('rw', this.db.contacts, async () => {
      await this.db.contacts.bulkPut(storables);
    });
  }

  async saveGroup(group: ContactGroup): Promise<void> {
    const storable = this.mapGroupToStorable(group);
    await this.db.contactGroups.put(storable);
  }

  async getGroup(id: URN): Promise<ContactGroup | undefined> {
    const storable = await this.db.contactGroups.get(id.toString());
    return storable ? this.mapStorableToGroup(storable) : undefined;
  }

  async deleteGroup(id: URN): Promise<void> {
    await this.db.contactGroups.delete(id.toString());
  }

  async getGroupsForContact(contactId: URN): Promise<ContactGroup[]> {
    const storables = await this.db.contactGroups
      .where('contactIds')
      .equals(contactId.toString())
      .toArray();
    return storables.map(this.mapStorableToGroup);
  }

  async getContactsForGroup(groupId: URN): Promise<Contact[]> {
    const groupStorable = await this.db.contactGroups.get(groupId.toString());
    if (!groupStorable || groupStorable.contactIds.length === 0) {
      return [];
    }

    const contactIdStrings = groupStorable.contactIds;
    const storables = await this.db.contacts.bulkGet(contactIdStrings);

    return storables
      .filter((c): c is StorableContact => Boolean(c))
      .map(this.mapStorableToContact);
  }

  // --- Federated Identity Linking Methods ---

  /**
   * Links a federated Authentication URN (e.g., urn:auth:google:bob) to a local Contact.
   */
  async linkIdentityToContact(contactId: URN, authUrn: URN): Promise<void> {
    // We store strictly primitive strings in the DB
    const storableLink: StorableIdentityLink = {
      contactId: contactId.toString(),
      authUrn: authUrn.toString(),
    };

    // Dexie handles the auto-incrementing 'id'
    await this.db.identity_links.put(storableLink);
  }

  /**
   * Retrieves all federated identities linked to a specific Contact.
   */
  async getLinkedIdentities(contactId: URN): Promise<URN[]> {
    const storables = await this.db.identity_links
      .where('contactId')
      .equals(contactId.toString())
      .toArray();

    return storables.map((link) => URN.parse(link.authUrn));
  }

  /**
   * Finds the local Contact associated with a specific federated Authentication URN.
   * This is the primary method for resolving incoming "Sender IDs" to "Conversations".
   */
  async findContactByAuthUrn(authUrn: URN): Promise<Contact | null> {
    // 1. Look up the link
    const link = await this.db.identity_links
      .where('authUrn')
      .equals(authUrn.toString())
      .first();

    if (!link) {
      return null;
    }

    // 2. If link exists, fetch the full contact
    const contactStorable = await this.db.contacts.get(link.contactId);

    return contactStorable ? this.mapStorableToContact(contactStorable) : null;
  }
}