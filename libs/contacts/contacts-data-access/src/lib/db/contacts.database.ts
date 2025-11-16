// libs/contacts/contacts-data-access/src/lib/db/contacts.database.ts

import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
// --- 1. Import the Storable interfaces as well ---
import {
  Contact,
  ContactGroup,
  StorableContact,
  StorableGroup,
} from '../models/contacts';
import { URN } from '@nx-platform-application/platform-types';

@Injectable({ providedIn: 'root' })
export class ContactsDatabase extends PlatformDexieService {
  // --- 2. Change Table types to use StorableContact and StorableGroup ---
  // The first generic is the type stored, the second is the key type.
  contacts!: Table<StorableContact, string>;
  contactGroups!: Table<StorableGroup, string>;

  constructor() {
    super('contacts');

    // SCHEMA EXPLANATION (v1):
    this.version(1).stores({
      contacts: 'id, alias, isFavorite, *phoneNumbers, *emailAddresses',
    });

    // SCHEMA EXPLANATION (v2):
    // This schema definition is correct. It tells Dexie to index the
    // 'id' and 'contactIds' properties, which will hold strings.
    this.version(2).stores({
      contacts: 'id, alias, isFavorite, *phoneNumbers, *emailAddresses',
      contactGroups: 'id, name, *contactIds',
    });

    // --- 3. Initialize the table properties (This part is unchanged) ---
    this.contacts = this.table('contacts');
    this.contactGroups = this.table('contactGroups');
  }
}