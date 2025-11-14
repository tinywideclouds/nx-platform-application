// libs/contacts/contacts-data-access/src/lib/contacts.service.ts

import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { Observable, from } from 'rxjs';
import { ContactsDatabase } from './db/contacts.database';
// 1. Import the new ContactGroup model
import { Contact, ContactGroup } from './models/contacts';

@Injectable({
  providedIn: 'root',
})
export class ContactsStorageService {
  // Inject the domain-specific database
  private readonly db = inject(ContactsDatabase);

  // --- Contact Streams ---

  /**
   * Live stream of all contacts, ordered alphabetically by alias.
   */
  readonly contacts$: Observable<Contact[]> = from(
    liveQuery(() => this.db.contacts.orderBy('alias').toArray())
  );

  /**
   * Live stream of favorite contacts.
   * Note: Dexie boolean indexes work seamlessly with true/false.
   */
  readonly favorites$: Observable<Contact[]> = from(
    liveQuery(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.db.contacts.where('isFavorite').equals(true as any).toArray()
    )
  );

  // --- NEW: Group Streams ---

  /**
   * Live stream of all contact groups, ordered alphabetically by name.
   */
  readonly groups$: Observable<ContactGroup[]> = from(
    liveQuery(() => this.db.contactGroups.orderBy('name').toArray())
  );

  // --- Contact CRUD ---

  /**
   * Create or Update a contact.
   * We use 'put' which acts as an upsert.
   */
  async saveContact(contact: Contact): Promise<void> {
    await this.db.contacts.put(contact);
  }

  /**
   * Updates specific fields of a contact without overwriting the whole record.
   */
  async updateContact(id: string, changes: Partial<Contact>): Promise<void> {
    await this.db.contacts.update(id, changes);
  }

  async getContact(id: string): Promise<Contact | undefined> {
    return this.db.contacts.get(id);
  }

  async deleteContact(id: string): Promise<void> {
    await this.db.contacts.delete(id);
  }

  /**
   * Finds a contact by ANY of their associated email addresses.
   * Leverages the multi-entry index '*emailAddresses'.
   */
  async findByEmail(email: string): Promise<Contact | undefined> {
    // 'emailAddresses' is a multi-entry index, so this query searches
    // inside the arrays of all contacts.
    return this.db.contacts.where('emailAddresses').equals(email).first();
  }

  /**
   * Finds a contact by ANY of their associated phone numbers.
   * Leverages the multi-entry index '*phoneNumbers'.
   */
  async findByPhone(phone: string): Promise<Contact | undefined> {
    return this.db.contacts.where('phoneNumbers').equals(phone).first();
  }

  /**
   * Bulk operation for syncing lists from a server.
   * Uses a transaction to ensure all-or-nothing safety.
   */
  async bulkUpsert(contacts: Contact[]): Promise<void> {
    await this.db.transaction('rw', this.db.contacts, async () => {
      await this.db.contacts.bulkPut(contacts);
    });
  }

  // --- NEW: Group CRUD & Queries ---

  /**
   * Create or Update a contact group.
   * We use 'put' which acts as an upsert.
   */
  async saveGroup(group: ContactGroup): Promise<void> {
    await this.db.contactGroups.put(group);
  }

  async getGroup(id: string): Promise<ContactGroup | undefined> {
    return this.db.contactGroups.get(id);
  }

  async deleteGroup(id: string): Promise<void> {
    await this.db.contactGroups.delete(id);
  }

  /**
   * Finds all groups that a specific contact is a member of.
   * Leverages the multi-entry index '*contactIds'.
   */
  async getGroupsForContact(contactId: string): Promise<ContactGroup[]> {
    return this.db.contactGroups
      .where('contactIds')
      .equals(contactId)
      .toArray();
  }

  /**
   * Retrieves the full Contact objects for a given group ID.
   */
  async getContactsForGroup(groupId: string): Promise<Contact[]> {
    const group = await this.db.contactGroups.get(groupId);
    if (!group || group.contactIds.length === 0) {
      return [];
    }
    
    // 1. Get the potentially mixed array
    const contacts = await this.db.contacts.bulkGet(group.contactIds);

    // 2. Filter out any 'undefined' results using a type predicate.
    // This handles cases where a contactId in a group doesn't
    // exist in the contacts table (e.g., it was deleted).
    return contacts.filter((c): c is Contact => Boolean(c));
  }
}