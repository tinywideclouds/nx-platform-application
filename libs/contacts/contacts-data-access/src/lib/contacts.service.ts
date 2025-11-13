import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { Observable, from } from 'rxjs';
import { ContactsDatabase } from './db/contacts.database';
import { Contact } from './models/contacts';

@Injectable({
  providedIn: 'root',
})
export class ContactsStorageService {
  // Inject the domain-specific database
  private readonly db = inject(ContactsDatabase);

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
}