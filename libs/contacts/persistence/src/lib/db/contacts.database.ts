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

    // ✅ VERSION 5: Polymorphic Groups Schema
    this.version(5).stores({
      contacts: 'id, alias, email, *emailAddresses, *phoneNumbers, isFavorite',

      // scope: To filter 'local' vs 'messenger'
      // parentId: To find all chats spawned from a template
      // *contactIds: MultiEntry index for reverse lookups
      groups: 'id, name, scope, parentId, *contactIds',

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
