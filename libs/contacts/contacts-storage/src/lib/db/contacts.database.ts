import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import {
  StorableContact,
  StorableGroup,
  StorableIdentityLink,
  StorablePendingIdentity,
  ContactTombstone,
} from '../models/contacts';

@Injectable({ providedIn: 'root' })
export class ContactsDatabase extends PlatformDexieService {
  contacts!: Table<StorableContact, string>;
  groups!: Table<StorableGroup, string>;
  links!: Table<StorableIdentityLink, number>;
  pending!: Table<StorablePendingIdentity, number>;
  tombstones!: Table<ContactTombstone, string>;

  constructor() {
    super('contacts');

    this.version(1).stores({
      contacts:
        'id, alias, email, [emailAddresses], [phoneNumbers], isFavorite',

      groups: 'id, name, *contactIds',

      links: '++id, authUrn, contactId',

      pending: '++id, urn, firstSeenAt',

      tombstones: 'urn',
    });

    this.contacts = this.table('contacts');
    this.groups = this.table('groups');
    this.links = this.table('links');
    this.pending = this.table('pending');
    this.tombstones = this.table('tombstones');
  }
}
