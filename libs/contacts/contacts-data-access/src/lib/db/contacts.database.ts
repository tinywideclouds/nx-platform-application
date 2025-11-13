import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import { Contact } from '../models/contacts';

@Injectable({ providedIn: 'root' })
export class ContactsDatabase extends PlatformDexieService {
  contacts!: Table<Contact, string>;

  constructor() {
    super('contacts');

    // SCHEMA EXPLANATION:
    // id: Primary Key
    // alias: Simple index for sorting
    // isFavorite: Simple index for filtering
    // *phoneNumbers: MULTI-ENTRY index. Allows db.contacts.where('phoneNumbers').equals('+123...')
    // *emailAddresses: MULTI-ENTRY index. Allows searching by any email in the list.
    this.version(1).stores({
      contacts: 'id, alias, isFavorite, *phoneNumbers, *emailAddresses',
    });

    this.contacts = this.table('contacts');
  }
}