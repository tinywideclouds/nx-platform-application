import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import {
  StorableContact,
  StorableGroup,
  StorableIdentityLink,
} from '../models/contacts';

@Injectable({ providedIn: 'root' })
export class ContactsDatabase extends PlatformDexieService {
  contacts!: Table<StorableContact, string>;
  contactGroups!: Table<StorableGroup, string>;
  identity_links!: Table<StorableIdentityLink, number>;

  constructor() {
    super('contacts');

    // SCHEMA EXPLANATION (v1):
    this.version(1).stores({
      contacts: 'id, alias, isFavorite, *phoneNumbers, *emailAddresses',
    });

    // SCHEMA EXPLANATION (v2):
    this.version(2).stores({
      contacts: 'id, alias, isFavorite, *phoneNumbers, *emailAddresses',
      contactGroups: 'id, name, *contactIds',
    });

    // SCHEMA EXPLANATION (v3):
    // Added identity_links table for Federated Identity support.
    // Indexes on contactId and authUrn allow for fast bidirectional lookups.
    this.version(3).stores({
      contacts: 'id, alias, isFavorite, *phoneNumbers, *emailAddresses',
      contactGroups: 'id, name, *contactIds',
      identity_links: '++id, contactId, authUrn',
    });

    this.contacts = this.table('contacts');
    this.contactGroups = this.table('contactGroups');
    this.identity_links = this.table('identity_links');
  }
}