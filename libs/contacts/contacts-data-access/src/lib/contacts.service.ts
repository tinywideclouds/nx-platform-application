// libs/contacts/contacts-data-access/src/lib/contacts.service.ts

import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators'; // <-- 1. Import map
import { ContactsDatabase } from './db/contacts.database';
// 2. Import all models
import {
  Contact,
  ContactGroup,
  StorableContact,
  StorableGroup,
  StorableServiceContact,
  ServiceContact,
} from './models/contacts';
import { URN } from '@nx-platform-application/platform-types';

@Injectable({
  providedIn: 'root',
})
export class ContactsStorageService {
  private readonly db = inject(ContactsDatabase);

  // --- 3. Add Mapper Functions ---

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

  // --- 4. Update LiveQuery Streams to use mappers ---
  // liveQuery now returns StorableContact[] or StorableGroup[].
  // The 'map' pipe correctly converts them to Contact[] or ContactGroup[].

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

  // --- 5. Update ALL CRUD methods to use mappers and string IDs ---

  async saveContact(contact: Contact): Promise<void> {
    const storable = this.mapContactToStorable(contact);
    await this.db.contacts.put(storable);
  }

  async updateContact(id: URN, changes: Partial<Contact>): Promise<void> {
    // 1. Destructure incompatible properties from the 'changes' object
    const {
      id: urnId,
      serviceContacts: domainServiceContacts,
      ...simpleChanges
    } = changes;

    // 2. Create the storable changes object with the simple, compatible properties
    const storableChanges: Partial<StorableContact> = {
      ...simpleChanges, // (e.g., alias, firstName, phoneNumbers)
    };

    // 3. Manually map and add the complex properties if they exist
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

    // 4. Call update with the string key and the storable changes
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
      .equals(contactId.toString()) // <-- Use string for query
      .toArray();
    return storables.map(this.mapStorableToGroup);
  }

  async getContactsForGroup(groupId: URN): Promise<Contact[]> {
    // 1. Get the StorableGroup
    const groupStorable = await this.db.contactGroups.get(groupId.toString());
    if (!groupStorable || groupStorable.contactIds.length === 0) {
      return [];
    }
    
    // 2. We already have the string IDs from the StorableGroup
    const contactIdStrings = groupStorable.contactIds;
    const storables = await this.db.contacts.bulkGet(contactIdStrings);

    // 3. Filter out undefined and map back to DOMAIN contacts
    return storables
      .filter((c): c is StorableContact => Boolean(c))
      .map(this.mapStorableToContact);
  }
}