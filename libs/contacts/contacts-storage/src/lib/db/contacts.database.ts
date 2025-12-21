import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import { ContactTombstone } from '@nx-platform-application/contacts-types'; // ✅ Import from new types lib
import {
  StorableContact,
  StorableGroup,
  StorableIdentityLink,
  StorablePendingIdentity,
  StorableBlockedIdentity,
} from '../models/contacts';

@Injectable({ providedIn: 'root' })
export class ContactsDatabase extends PlatformDexieService {
  contacts!: Table<StorableContact, string>;
  groups!: Table<StorableGroup, string>;
  links!: Table<StorableIdentityLink, number>;
  pending!: Table<StorablePendingIdentity, number>;
  blocked!: Table<StorableBlockedIdentity, number>;
  tombstones!: Table<ContactTombstone, string>;

  constructor() {
    super('contacts');

    // VERSION 3
    this.version(3).stores({
      // Use * for MultiEntry indexes (arrays of strings)
      contacts: 'id, alias, email, *emailAddresses, *phoneNumbers, isFavorite',

      groups: 'id, name, *contactIds',

      links: '++id, authUrn, contactId',

      pending: '++id, urn, firstSeenAt',

      blocked: '++id, urn, blockedAt',

      tombstones: 'urn',
    });

    this.contacts = this.table('contacts');
    this.groups = this.table('groups');
    this.links = this.table('links');
    this.pending = this.table('pending');
    this.blocked = this.table('blocked');
    this.tombstones = this.table('tombstones');
  }
}
