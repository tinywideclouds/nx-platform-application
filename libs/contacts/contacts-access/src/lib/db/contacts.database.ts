import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import {
  StorableContact,
  StorableGroup,
  StorableIdentityLink,
  StorableBlockedIdentity,
  StorablePendingIdentity,
} from '../models/contacts';

@Injectable({ providedIn: 'root' })
export class ContactsDatabase extends PlatformDexieService {
  contacts!: Table<StorableContact, string>;
  contactGroups!: Table<StorableGroup, string>;
  identity_links!: Table<StorableIdentityLink, number>;

  // Gatekeeper Tables
  blocked_identities!: Table<StorableBlockedIdentity, number>;
  pending_identities!: Table<StorablePendingIdentity, number>; // The Waiting Room

  constructor() {
    super('contacts');

    // v1
    this.version(1).stores({
      contacts: 'id, alias, isFavorite, *phoneNumbers, *emailAddresses',
    });

    // v2
    this.version(2).stores({
      contacts: 'id, alias, isFavorite, *phoneNumbers, *emailAddresses',
      contactGroups: 'id, name, *contactIds',
    });

    // v3
    this.version(3).stores({
      contacts: 'id, alias, isFavorite, *phoneNumbers, *emailAddresses',
      contactGroups: 'id, name, *contactIds',
      identity_links: '++id, contactId, authUrn',
    });

    // v4: Gatekeeper
    // blocked_identities: Deny list
    // pending_identities: The "Waiting Room" for Unknowns + Vouched
    this.version(4).stores({
      contacts: 'id, alias, isFavorite, *phoneNumbers, *emailAddresses',
      contactGroups: 'id, name, *contactIds',
      identity_links: '++id, contactId, authUrn',
      blocked_identities: '++id, urn, blockedAt',
      pending_identities: '++id, urn, vouchedBy, firstSeenAt',
    });

    this.contacts = this.table('contacts');
    this.contactGroups = this.table('contactGroups');
    this.identity_links = this.table('identity_links');
    this.blocked_identities = this.table('blocked_identities');
    this.pending_identities = this.table('pending_identities');
  }
}
