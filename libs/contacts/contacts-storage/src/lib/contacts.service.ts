// libs/contacts/contacts-storage/src/lib/contacts.service.ts

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
  StorablePendingIdentity,
  PendingIdentity,
  ContactTombstone,
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

  // --- Mappers (RESTORED) ---
  private mapStorableToContact(c: StorableContact): Contact {
    const serviceContacts: Record<string, ServiceContact> = {};

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
      lastModified: c.lastModified, // ✅ Pass through
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
      lastModified: c.lastModified, // ✅ Pass through
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

  private mapStorableToPending(p: StorablePendingIdentity): PendingIdentity {
    return {
      ...p,
      urn: URN.parse(p.urn),
      vouchedBy: p.vouchedBy ? URN.parse(p.vouchedBy) : undefined,
    };
  }

  // --- LiveQuery Streams ---

  readonly contacts$: Observable<Contact[]> = from(
    liveQuery(() => this.db.contacts.orderBy('alias').toArray())
  ).pipe(
    map((storables) => storables.map((c) => this.mapStorableToContact(c)))
  );

  readonly favorites$: Observable<Contact[]> = from(
    liveQuery(() =>
      this.db.contacts
        .where('isFavorite')
        .equals(true as any)
        .toArray()
    )
  ).pipe(
    map((storables) => storables.map((c) => this.mapStorableToContact(c)))
  );

  // ✅ UPDATED: Use 'groups'
  readonly groups$: Observable<ContactGroup[]> = from(
    liveQuery(() => this.db.groups.orderBy('name').toArray())
  ).pipe(map((storables) => storables.map((g) => this.mapStorableToGroup(g))));

  // ✅ UPDATED: Use 'pending'
  readonly pending$: Observable<PendingIdentity[]> = from(
    liveQuery(() => this.db.pending.orderBy('firstSeenAt').toArray())
  ).pipe(
    map((storables) => storables.map((p) => this.mapStorableToPending(p)))
  );

  // REMOVED: blocked$ (Moved to Messenger)

  // --- CRUD Methods ---

  async saveContact(contact: Contact): Promise<void> {
    // ✅ SMART SYNC: Update timestamp
    const now = new Date().toISOString() as ISODateTimeString;
    const contactWithTime = { ...contact, lastModified: now };
    const storable = this.mapContactToStorable(contactWithTime);

    // ✅ SMART SYNC: Transaction
    await this.db.transaction(
      'rw',
      [this.db.contacts, this.db.tombstones],
      async () => {
        await this.db.tombstones.delete(storable.id);
        await this.db.contacts.put(storable);
      }
    );
  }

  async updateContact(id: URN, changes: Partial<Contact>): Promise<void> {
    const {
      id: urnId,
      serviceContacts: domainServiceContacts,
      ...simpleChanges
    } = changes;

    // ✅ SMART SYNC: Update Timestamp
    const storableChanges: Partial<StorableContact> = {
      ...simpleChanges,
      lastModified: new Date().toISOString() as ISODateTimeString,
    };

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
    const urnStr = id.toString();
    const now = new Date().toISOString() as ISODateTimeString;

    // ✅ SMART SYNC: Create Tombstone
    await this.db.transaction(
      'rw',
      [this.db.contacts, this.db.tombstones],
      async () => {
        await this.db.contacts.delete(urnStr);
        await this.db.tombstones.put({ urn: urnStr, deletedAt: now });
      }
    );
  }

  async findByEmail(email: string): Promise<Contact | undefined> {
    let storable = await this.db.contacts.where('email').equals(email).first();
    if (!storable) {
      storable = await this.db.contacts
        .where('emailAddresses')
        .equals(email)
        .first();
    }
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
    const storables = contacts.map((c) => this.mapContactToStorable(c));
    await this.db.transaction('rw', this.db.contacts, async () => {
      await this.db.contacts.bulkPut(storables);
    });
  }

  // --- Group Methods ---

  async saveGroup(group: ContactGroup): Promise<void> {
    const storable = this.mapGroupToStorable(group);
    // ✅ UPDATED: Use 'groups'
    await this.db.groups.put(storable);
  }

  async getGroup(id: URN): Promise<ContactGroup | undefined> {
    // ✅ UPDATED: Use 'groups'
    const storable = await this.db.groups.get(id.toString());
    return storable ? this.mapStorableToGroup(storable) : undefined;
  }

  async deleteGroup(id: URN): Promise<void> {
    await this.db.groups.delete(id.toString());
  }

  async getGroupsForContact(contactId: URN): Promise<ContactGroup[]> {
    const storables = await this.db.groups
      .where('contactIds')
      .equals(contactId.toString())
      .toArray();
    return storables.map((g) => this.mapStorableToGroup(g));
  }

  async getContactsForGroup(groupId: URN): Promise<Contact[]> {
    const groupStorable = await this.db.groups.get(groupId.toString());
    if (!groupStorable || groupStorable.contactIds.length === 0) return [];

    const contactIdStrings = groupStorable.contactIds;
    const storables = await this.db.contacts.bulkGet(contactIdStrings);
    return storables
      .filter((c): c is StorableContact => Boolean(c))
      .map((c) => this.mapStorableToContact(c));
  }

  // --- Identity Links ---

  async linkIdentityToContact(contactId: URN, authUrn: URN): Promise<void> {
    // ✅ UPDATED: Use 'links'
    await this.db.links.put({
      contactId: contactId.toString(),
      authUrn: authUrn.toString(),
    });
  }

  async getLinkedIdentities(contactId: URN): Promise<URN[]> {
    // ✅ UPDATED: Use 'links'
    const list = await this.db.links
      .where('contactId')
      .equals(contactId.toString())
      .toArray();
    return list.map((l) => URN.parse(l.authUrn));
  }

  async getAllIdentityLinks(): Promise<IdentityLink[]> {
    const list = await this.db.links.toArray();
    return list.map((l) => ({
      id: l.id,
      contactId: URN.parse(l.contactId),
      authUrn: URN.parse(l.authUrn),
    }));
  }

  async findContactByAuthUrn(authUrn: URN): Promise<Contact | null> {
    const link = await this.db.links
      .where('authUrn')
      .equals(authUrn.toString())
      .first();
    if (!link) return null;
    const c = await this.db.contacts.get(link.contactId);
    return c ? this.mapStorableToContact(c) : null;
  }

  // --- Gatekeeper: Pending ---

  async addToPending(urn: URN, vouchedBy?: URN, note?: string): Promise<void> {
    // ✅ UPDATED: Use 'pending'
    const existing = await this.db.pending
      .where('urn')
      .equals(urn.toString())
      .first();

    const pending: StorablePendingIdentity = {
      id: existing?.id,
      urn: urn.toString(),
      firstSeenAt:
        existing?.firstSeenAt ??
        (new Date().toISOString() as ISODateTimeString),
      vouchedBy: vouchedBy ? vouchedBy.toString() : existing?.vouchedBy,
      note: note ?? existing?.note,
    };
    await this.db.pending.put(pending);
  }

  async getPendingIdentity(urn: URN): Promise<PendingIdentity | null> {
    const storable = await this.db.pending
      .where('urn')
      .equals(urn.toString())
      .first();

    if (!storable) return null;
    return this.mapStorableToPending(storable);
  }

  async deletePending(urn: URN): Promise<void> {
    const records = await this.db.pending
      .where('urn')
      .equals(urn.toString())
      .toArray();

    const idsToDelete = records
      .map((r) => r.id!)
      .filter((id) => id !== undefined);
    if (idsToDelete.length > 0) {
      await this.db.pending.bulkDelete(idsToDelete);
    }
  }

  // --- Sync Helpers ---
  async getAllTombstones(): Promise<ContactTombstone[]> {
    return this.db.tombstones.toArray();
  }

  async getAllContacts(): Promise<Contact[]> {
    const list = await this.db.contacts.toArray();
    return list.map((c) => this.mapStorableToContact(c));
  }

  async getAllGroups(): Promise<ContactGroup[]> {
    const list = await this.db.groups.toArray();
    return list.map((g) => this.mapStorableToGroup(g));
  }

  async clearDatabase(): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.contacts,
        this.db.groups,
        this.db.links,
        this.db.pending,
        this.db.tombstones,
      ],
      () => {
        return Promise.all([
          this.db.contacts.clear(),
          this.db.groups.clear(),
          this.db.links.clear(),
          this.db.pending.clear(),
          this.db.tombstones.clear(),
        ]);
      }
    );
  }
}
