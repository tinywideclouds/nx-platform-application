// libs/contacts/contacts-access/src/lib/contacts.service.ts

import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs';
import { ContactsDatabase } from './db/contacts.database';
import {
  Contact,
  ContactGroup,
  StorableContact,
  StorableGroup,
  StorableServiceContact,
  ServiceContact,
  IdentityLink,
  StorableIdentityLink,
  StorableBlockedIdentity,
  StorablePendingIdentity,
  BlockedIdentity,
  PendingIdentity,
} from './models/contacts';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

@Injectable({
  providedIn: 'root',
})
export class ContactsStorageService {
  private readonly db = inject(ContactsDatabase);

  // --- Mappers ---
  private mapStorableToContact(c: StorableContact): Contact {
    const serviceContacts: Record<string, ServiceContact> = {};

    // usage: Object.entries(obj || {}) avoids "cannot convert undefined to object" errors
    for (const [key, s] of Object.entries(c.serviceContacts || {})) {
      if (s) {
        serviceContacts[key] = {
          ...s,
          id: URN.parse(s.id),
        };
      }
    }

    return {
      ...c,
      id: URN.parse(c.id),
      serviceContacts,
    };
  }

  private mapContactToStorable(c: Contact): StorableContact {
    const serviceContacts: Record<string, StorableServiceContact> = {};

    for (const [key, s] of Object.entries(c.serviceContacts || {})) {
      if (s) {
        serviceContacts[key] = {
          ...s,
          id: s.id.toString(),
        };
      }
    }

    return {
      ...c,
      id: c.id.toString(),
      serviceContacts,
    };
  }

  private mapStorableToGroup(g: StorableGroup): ContactGroup {
    return {
      ...g,
      id: URN.parse(g.id),
      contactIds: g.contactIds.map((id) => URN.parse(id)),
    };
  }

  private mapGroupToStorable(g: ContactGroup): StorableGroup {
    return {
      ...g,
      id: g.id.toString(),
      contactIds: g.contactIds.map((id) => id.toString()),
    };
  }

  private mapStorableToBlocked(b: StorableBlockedIdentity): BlockedIdentity {
    return {
      ...b,
      urn: URN.parse(b.urn),
    };
  }

  private mapStorableToPending(p: StorablePendingIdentity): PendingIdentity {
    return {
      ...p,
      urn: URN.parse(p.urn),
      // Only parse vouchedBy if it exists
      vouchedBy: p.vouchedBy ? URN.parse(p.vouchedBy) : undefined,
    };
  }

  // --- LiveQuery Streams ---

  readonly contacts$: Observable<Contact[]> = from(
    liveQuery(() => this.db.contacts.orderBy('alias').toArray())
  ).pipe(map((storables) => storables.map(this.mapStorableToContact)));

  readonly favorites$: Observable<Contact[]> = from(
    liveQuery(() =>
      this.db.contacts
        .where('isFavorite')
        .equals(true as any)
        .toArray()
    )
  ).pipe(map((storables) => storables.map(this.mapStorableToContact)));

  readonly groups$: Observable<ContactGroup[]> = from(
    liveQuery(() => this.db.contactGroups.orderBy('name').toArray())
  ).pipe(map((storables) => storables.map(this.mapStorableToGroup)));

  /**
   * Stream of all blocked identities.
   */
  readonly blocked$: Observable<BlockedIdentity[]> = from(
    liveQuery(() => this.db.blocked_identities.orderBy('blockedAt').toArray())
  ).pipe(map((storables) => storables.map(this.mapStorableToBlocked)));

  /**
   * The Waiting Room.
   * Stream of all identities awaiting action (Unknowns + Vouched).
   */
  readonly pending$: Observable<PendingIdentity[]> = from(
    liveQuery(() => this.db.pending_identities.orderBy('firstSeenAt').toArray())
  ).pipe(map((storables) => storables.map(this.mapStorableToPending)));

  // --- CRUD Methods (Contacts/Groups) ---

  async saveContact(contact: Contact): Promise<void> {
    const storable = this.mapContactToStorable(contact);
    await this.db.contacts.put(storable);
  }

  async updateContact(id: URN, changes: Partial<Contact>): Promise<void> {
    const {
      id: urnId,
      serviceContacts: domainServiceContacts,
      ...simpleChanges
    } = changes;
    const storableChanges: Partial<StorableContact> = { ...simpleChanges };

    if (urnId) storableChanges.id = urnId.toString();
    if (domainServiceContacts) {
      const serviceContacts: Record<string, StorableServiceContact> = {};
      for (const key in domainServiceContacts) {
        const s = domainServiceContacts[key];
        if (s) serviceContacts[key] = { ...s, id: s.id.toString() };
      }
      storableChanges.serviceContacts = serviceContacts;
    }
    await this.db.contacts.update(id.toString(), storableChanges);
  }

  async getContact(id: URN): Promise<Contact | undefined> {
    const storable = await this.db.contacts.get(id.toString());
    return storable ? this.mapStorableToContact(storable) : undefined;
  }

  async deleteContact(id: URN): Promise<void> {
    await this.db.contacts.delete(id.toString());
  }

  async findByEmail(email: string): Promise<Contact | undefined> {
    const storable = await this.db.contacts
      .where('emailAddresses')
      .equals(email)
      .first();
    return storable ? this.mapStorableToContact(storable) : undefined;
  }

  async findByPhone(phone: string): Promise<Contact | undefined> {
    const storable = await this.db.contacts
      .where('phoneNumbers')
      .equals(phone)
      .first();
    return storable ? this.mapStorableToContact(storable) : undefined;
  }

  async bulkUpsert(contacts: Contact[]): Promise<void> {
    const storables = contacts.map(this.mapContactToStorable);
    await this.db.transaction('rw', this.db.contacts, async () => {
      await this.db.contacts.bulkPut(storables);
    });
  }

  async saveGroup(group: ContactGroup): Promise<void> {
    const storable = this.mapGroupToStorable(group);
    await this.db.contactGroups.put(storable);
  }

  async getGroup(id: URN): Promise<ContactGroup | undefined> {
    const storable = await this.db.contactGroups.get(id.toString());
    return storable ? this.mapStorableToGroup(storable) : undefined;
  }

  async deleteGroup(id: URN): Promise<void> {
    await this.db.contactGroups.delete(id.toString());
  }

  async getGroupsForContact(contactId: URN): Promise<ContactGroup[]> {
    const storables = await this.db.contactGroups
      .where('contactIds')
      .equals(contactId.toString())
      .toArray();
    return storables.map(this.mapStorableToGroup);
  }

  async getContactsForGroup(groupId: URN): Promise<Contact[]> {
    const groupStorable = await this.db.contactGroups.get(groupId.toString());
    if (!groupStorable || groupStorable.contactIds.length === 0) return [];
    const contactIdStrings = groupStorable.contactIds;
    const storables = await this.db.contacts.bulkGet(contactIdStrings);
    return storables
      .filter((c): c is StorableContact => Boolean(c))
      .map(this.mapStorableToContact);
  }

  // --- Federated Identity Linking Methods ---

  async linkIdentityToContact(contactId: URN, authUrn: URN): Promise<void> {
    const storableLink: StorableIdentityLink = {
      contactId: contactId.toString(),
      authUrn: authUrn.toString(),
    };
    await this.db.identity_links.put(storableLink);
  }

  async getLinkedIdentities(contactId: URN): Promise<URN[]> {
    const storables = await this.db.identity_links
      .where('contactId')
      .equals(contactId.toString())
      .toArray();
    return storables.map((link) => URN.parse(link.authUrn));
  }

  async getAllIdentityLinks(): Promise<IdentityLink[]> {
    const storables = await this.db.identity_links.toArray();
    return storables.map((link) => ({
      id: link.id,
      contactId: URN.parse(link.contactId),
      authUrn: URN.parse(link.authUrn),
    }));
  }

  async findContactByAuthUrn(authUrn: URN): Promise<Contact | null> {
    const link = await this.db.identity_links
      .where('authUrn')
      .equals(authUrn.toString())
      .first();
    if (!link) return null;
    const contactStorable = await this.db.contacts.get(link.contactId);
    return contactStorable ? this.mapStorableToContact(contactStorable) : null;
  }

  // --- Gatekeeper: Blocking ---

  async blockIdentity(urn: URN, reason?: string): Promise<void> {
    const blocked: StorableBlockedIdentity = {
      urn: urn.toString(),
      blockedAt: new Date().toISOString() as ISODateTimeString,
      reason,
    };
    await this.db.blocked_identities.put(blocked);
  }

  async unblockIdentity(urn: URN): Promise<void> {
    const records = await this.db.blocked_identities
      .where('urn')
      .equals(urn.toString())
      .toArray();

    const idsToDelete = records
      .map((r) => r.id!)
      .filter((id) => id !== undefined);
    if (idsToDelete.length > 0) {
      await this.db.blocked_identities.bulkDelete(idsToDelete);
    }
  }

  async getAllBlockedIdentityUrns(): Promise<string[]> {
    const storables = await this.db.blocked_identities.toArray();
    return storables.map((b) => b.urn);
  }

  // --- Gatekeeper: The Waiting Room (Pending) ---

  /**
   * Adds an identity to the Waiting Room.
   * Can be a random stranger (no voucher) or a referral (with voucher).
   */
  async addToPending(urn: URN, vouchedBy?: URN, note?: string): Promise<void> {
    // Upsert logic: if it's already pending, we might be adding a vouch to it.
    const existing = await this.db.pending_identities
      .where('urn')
      .equals(urn.toString())
      .first();

    const pending: StorablePendingIdentity = {
      id: existing?.id, // Preserve ID if updating
      urn: urn.toString(),
      // Preserve original timestamp or set new
      firstSeenAt:
        existing?.firstSeenAt ??
        (new Date().toISOString() as ISODateTimeString),
      // Overwrite vouch if new one is provided, otherwise keep existing
      vouchedBy: vouchedBy ? vouchedBy.toString() : existing?.vouchedBy,
      note: note ?? existing?.note,
    };
    await this.db.pending_identities.put(pending);
  }

  async getPendingIdentity(urn: URN): Promise<PendingIdentity | null> {
    const storable = await this.db.pending_identities
      .where('urn')
      .equals(urn.toString())
      .first();

    if (!storable) return null;
    return this.mapStorableToPending(storable);
  }

  /**
   * Removes an identity from the Waiting Room.
   * Call this when:
   * 1. User Blocks the identity (move to blocked_identities)
   * 2. User Adds/Links the identity (move to identity_links)
   */
  async deletePending(urn: URN): Promise<void> {
    const records = await this.db.pending_identities
      .where('urn')
      .equals(urn.toString())
      .toArray();

    const idsToDelete = records
      .map((r) => r.id!)
      .filter((id) => id !== undefined);
    if (idsToDelete.length > 0) {
      await this.db.pending_identities.bulkDelete(idsToDelete);
    }
  }

  /**
   * Wipes all contact data from the local device.
   * Used on Logout.
   */
  async clearDatabase(): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.contacts,
        this.db.contactGroups,
        this.db.identity_links,
        this.db.blocked_identities,
        this.db.pending_identities,
      ],
      () => {
        return Promise.all([
          this.db.contacts.clear(),
          this.db.contactGroups.clear(),
          this.db.identity_links.clear(),
          this.db.blocked_identities.clear(),
          this.db.pending_identities.clear(),
        ]);
      }
    );
  }
}
