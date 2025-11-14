// libs/contacts/contacts-data-access/src/lib/db/contacts.database.ts

import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
// 1. Import the new model
import { Contact, ContactGroup } from '../models/contacts';

@Injectable({ providedIn: 'root' })
export class ContactsDatabase extends PlatformDexieService {
  contacts!: Table<Contact, string>;
  // 2. Define the new table property
  contactGroups!: Table<ContactGroup, string>;

  constructor() {
    super('contacts');

    // SCHEMA EXPLANATION (v1):
    // id: Primary Key
    // alias: Simple index for sorting
    // isFavorite: Simple index for filtering
    // *phoneNumbers: MULTI-ENTRY index. Allows db.contacts.where('phoneNumbers').equals('+123...')
    // *emailAddresses: MULTI-ENTRY index. Allows searching by any email in the list.
    this.version(1).stores({
      contacts: 'id, alias, isFavorite, *phoneNumbers, *emailAddresses',
    });

    // SCHEMA EXPLANATION (v2):
    // 3. Increment the version to 2
    // 4. Add the new 'contactGroups' table
    //    id: Primary Key
    //    name: Simple index for sorting
    //    *contactIds: MULTI-ENTRY index to find groups for a contact
    this.version(2).stores({
      contacts: 'id, alias, isFavorite, *phoneNumbers, *emailAddresses',
      contactGroups: 'id, name, *contactIds',
    });

    // 5. Initialize the table properties
    this.contacts = this.table('contacts');
    this.contactGroups = this.table('contactGroups');
  }
}