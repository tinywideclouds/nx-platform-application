import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { Observable, from, map } from 'rxjs';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  Contact,
  ContactGroup,
  IdentityLink,
  ContactTombstone,
} from '@nx-platform-application/contacts-types';

import {
  ContactsDatabase,
  ContactMapper,
  GroupMapper,
  StorableContact,
} from '@nx-platform-application/contacts-infrastructure-indexed-db';

@Injectable({
  providedIn: 'root',
})
export class ContactsStorageService {
  private readonly db = inject(ContactsDatabase);
  private readonly contactMapper = inject(ContactMapper);
  private readonly groupMapper = inject(GroupMapper);

  // --- QUERIES ---

  readonly contacts$: Observable<Contact[]> = from(
    liveQuery(() => this.db.contacts.orderBy('alias').toArray()),
  ).pipe(
    map((storables) => storables.map((c) => this.contactMapper.toDomain(c))),
  );

  readonly favorites$: Observable<Contact[]> = from(
    liveQuery(() =>
      this.db.contacts.filter((c) => (c as any).isFavorite === true).toArray(),
    ),
  ).pipe(
    map((storables) => storables.map((c) => this.contactMapper.toDomain(c))),
  );

  readonly groups$: Observable<ContactGroup[]> = from(
    liveQuery(() => this.db.groups.orderBy('name').toArray()),
  ).pipe(
    map((storables) => storables.map((g) => this.groupMapper.toDomain(g))),
  );

  readonly links$: Observable<IdentityLink[]> = from(
    liveQuery(() => this.db.links.toArray()),
  ).pipe(
    map((storables) =>
      storables.map((l) => ({
        id: l.id,
        contactId: URN.parse(l.contactId),
        authUrn: URN.parse(l.authUrn),
        scope: l.scope,
      })),
    ),
  );

  // --- CONTACT COMMANDS ---

  async saveContact(contact: Contact): Promise<void> {
    const now = Temporal.Now.instant().toString() as ISODateTimeString;
    // Fix: No serviceContacts in storable
    const { serviceContacts, ...rest } = contact;
    const contactWithTime = { ...rest, serviceContacts: {}, lastModified: now };

    const storable = this.contactMapper.toStorable(contactWithTime as Contact);

    await this.db.transaction(
      'rw',
      [this.db.contacts, this.db.tombstones],
      async () => {
        await this.db.tombstones.delete(storable.id);
        await this.db.contacts.put(storable);
      },
    );
  }

  async updateContact(id: URN, changes: Partial<Contact>): Promise<void> {
    if (!id) return;
    const { id: urnId, serviceContacts: _ignored, ...simpleChanges } = changes;

    const storableChanges: Partial<StorableContact> = {
      ...simpleChanges,
      lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
    };

    if (urnId) storableChanges.id = urnId.toString();

    await this.db.contacts.update(id.toString(), storableChanges);
  }

  async getContact(id: URN): Promise<Contact | undefined> {
    if (!id) return undefined;
    const storable = await this.db.contacts.get(id.toString());
    return storable ? this.contactMapper.toDomain(storable) : undefined;
  }

  async deleteContact(id: URN): Promise<void> {
    if (!id) return;
    const urnStr = id.toString();
    const now = Temporal.Now.instant().toString() as ISODateTimeString;
    await this.db.transaction(
      'rw',
      [this.db.contacts, this.db.links, this.db.tombstones],
      async () => {
        await this.db.contacts.delete(urnStr);
        await this.db.links.where('contactId').equals(urnStr).delete();
        await this.db.tombstones.put({ urn: urnStr, deletedAt: now });
      },
    );
  }

  async findByEmail(email: string): Promise<Contact | undefined> {
    if (!email) return undefined;
    let storable = await this.db.contacts.where('email').equals(email).first();
    if (!storable) {
      storable = await this.db.contacts
        .where('emailAddresses')
        .equals(email)
        .first();
    }
    return storable ? this.contactMapper.toDomain(storable) : undefined;
  }

  async findByPhone(phone: string): Promise<Contact | undefined> {
    if (!phone) return undefined;
    const storable = await this.db.contacts
      .where('phoneNumbers')
      .equals(phone)
      .first();
    return storable ? this.contactMapper.toDomain(storable) : undefined;
  }

  async bulkUpsert(contacts: Contact[]): Promise<void> {
    const storables = contacts.map((c) => this.contactMapper.toStorable(c));
    await this.db.transaction('rw', this.db.contacts, async () => {
      await this.db.contacts.bulkPut(storables);
    });
  }

  // --- GROUP COMMANDS ---

  async saveGroup(group: ContactGroup): Promise<void> {
    const storable = this.groupMapper.toStorable(group);
    await this.db.groups.put(storable);
  }

  async bulkUpsertGroups(groups: ContactGroup[]): Promise<void> {
    const storables = groups.map((g) => this.groupMapper.toStorable(g));
    await this.db.transaction('rw', this.db.groups, async () => {
      await this.db.groups.bulkPut(storables);
    });
  }

  async getGroup(id: URN): Promise<ContactGroup | undefined> {
    if (!id) return undefined;
    const storable = await this.db.groups.get(id.toString());
    return storable ? this.groupMapper.toDomain(storable) : undefined;
  }

  /**
   * ✅ RESTORED V9 LOGIC
   * We infer scope based on the 'directoryId' field.
   * - Present: Messenger Linked
   * - Missing: Local Only
   */
  async getGroupsByScope(
    scope: 'local' | 'messenger',
  ): Promise<ContactGroup[]> {
    const all = await this.db.groups.toArray();

    if (scope === 'local') {
      // Filter for groups WITHOUT a directoryId
      return all
        .filter((g) => !g.directoryId)
        .map((g) => this.groupMapper.toDomain(g));
    } else {
      // Filter for groups WITH a directoryId
      return all
        .filter((g) => !!g.directoryId)
        .map((g) => this.groupMapper.toDomain(g));
    }
  }

  async getGroupsByParent(parentId: URN): Promise<ContactGroup[]> {
    // Note: parentId support was removed from Schema V7+.
    // If you need this, we must add 'parentId' back to StorableGroup.
    // For now, returning empty as per current schema.
    return [];
  }

  async deleteGroup(id: URN): Promise<void> {
    if (!id) return;
    await this.db.groups.delete(id.toString());
  }

  // --- LINKS ---

  async linkIdentityToContact(
    contactId: URN,
    authUrn: URN,
    scope = 'address-book',
  ): Promise<void> {
    if (!contactId || !authUrn) return;
    await this.db.links.put({
      contactId: contactId.toString(),
      authUrn: authUrn.toString(),
      scope,
    });
  }

  async getLinkedIdentities(contactId: URN): Promise<URN[]> {
    if (!contactId) return [];
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
      scope: l.scope,
    }));
  }

  async findContactByAuthUrn(authUrn: URN): Promise<Contact | null> {
    if (!authUrn) return null;
    const link = await this.db.links
      .where('authUrn')
      .equals(authUrn.toString())
      .first();
    if (!link) return null;
    const c = await this.db.contacts.get(link.contactId);
    return c ? this.contactMapper.toDomain(c) : null;
  }

  async getAllTombstones(): Promise<ContactTombstone[]> {
    return this.db.tombstones.toArray();
  }

  async getAllContacts(): Promise<Contact[]> {
    const list = await this.db.contacts.toArray();
    return list.map((c) => this.contactMapper.toDomain(c));
  }

  async getAllGroups(): Promise<ContactGroup[]> {
    const list = await this.db.groups.toArray();
    return list.map((g) => this.groupMapper.toDomain(g));
  }

  async clearAllContacts(): Promise<void> {
    await this.db.contacts.clear();
    await this.db.links.clear();
  }

  /**
   * ✅ RESTORED V9 LOGIC
   * Uses the *contactIds MultiEntry index to find groups a user belongs to.
   */
  async getGroupsForContact(contactId: URN): Promise<ContactGroup[]> {
    if (!contactId) return [];

    // Dexie Magic: Query the array index
    const groups = await this.db.groups
      .where('contactIds')
      .equals(contactId.toString())
      .toArray();

    return groups.map((g) => this.groupMapper.toDomain(g));
  }

  /**
   * ✅ RESTORED V9 LOGIC
   * Fetches the members of a local group.
   */
  async getContactsForGroup(groupId: URN): Promise<Contact[]> {
    const group = await this.db.groups.get(groupId.toString());
    if (!group || !group.contactIds || group.contactIds.length === 0) {
      return [];
    }

    // Bulk fetch the contacts
    const contacts = await this.db.contacts.bulkGet(group.contactIds);

    // Filter out undefined (in case a contact was deleted but ID remained)
    return contacts
      .filter((c): c is StorableContact => !!c)
      .map((c) => this.contactMapper.toDomain(c));
  }

  async clearDatabase(): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.contacts,
        this.db.groups,
        this.db.links,
        this.db.pending,
        this.db.blocked,
        this.db.tombstones,
      ],
      () => {
        return Promise.all([
          this.db.contacts.clear(),
          this.db.groups.clear(),
          this.db.links.clear(),
          this.db.pending.clear(),
          this.db.blocked.clear(),
          this.db.tombstones.clear(),
        ]);
      },
    );
  }
}
