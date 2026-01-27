import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-infrastructure-indexed-db';
import { ContactTombstone } from '@nx-platform-application/contacts-types';
import {
  StorableContact,
  StorableIdentityLink,
  StorablePendingIdentity,
  StorableBlockedIdentity,
} from '../records/contact.record';
import { StorableGroup } from '../records/group.record';

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

    // PREVIOUS VERSIONS (History)
    this.version(6).stores({
      contacts: 'id, alias, email, *emailAddresses, *phoneNumbers',
      groups: 'id, name, scope, parentId, *contactIds',
      links: '++id, authUrn, contactId, scope',
      pending: '++id, urn, firstSeenAt',
      blocked: '++id, urn, blockedAt',
      tombstones: 'urn',
    });

    // ... (V7/V8 History omitted for brevity/clarity in source, but kept in DB)

    // ✅ VERSION 9: The Revert
    // Restoring *contactIds to allow local group membership queries.
    this.version(9).stores({
      contacts: 'id, alias, email, *emailAddresses, *phoneNumbers',
      // Added *contactIds back
      groups: 'id, directoryId, name, *contactIds',
      links: '++id, authUrn, contactId, scope',
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
