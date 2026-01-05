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

// ✅ NEW IMPORTS: Consuming the Persistence Library
import {
  ContactsDatabase,
  ContactMapper,
  GroupMapper,
  StorableContact,
} from '@nx-platform-application/contacts-persistence';

/**
 * RESPONSIBILITY: Address Book & Local Data
 * Manages the User's Contacts and Groups.
 * Network-specific logic (Consensus, Gatekeeper) is broken out into separate services.
 */
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

  // --- CONTACT COMMANDS ---

  async saveContact(contact: Contact): Promise<void> {
    const now = Temporal.Now.instant().toString() as ISODateTimeString;
    const contactWithTime = { ...contact, lastModified: now };
    const storable = this.contactMapper.toStorable(contactWithTime);

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
    const {
      id: urnId,
      serviceContacts: domainServiceContacts,
      ...simpleChanges
    } = changes;

    const storableChanges: Partial<StorableContact> = {
      ...simpleChanges,
      lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
    };

    if (urnId) storableChanges.id = urnId.toString();
    if (domainServiceContacts) {
      const serviceContacts: Record<string, any> = {};
      for (const key in domainServiceContacts) {
        const s = domainServiceContacts[key];
        if (s) serviceContacts[key] = { ...s, id: s.id.toString() };
      }
      storableChanges.serviceContacts = serviceContacts;
    }
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
      [this.db.contacts, this.db.tombstones],
      async () => {
        await this.db.contacts.delete(urnStr);
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

  // --- GROUP COMMANDS (Local Stuff) ---

  async saveGroup(group: ContactGroup): Promise<void> {
    const storable = this.groupMapper.toStorable(group);
    await this.db.groups.put(storable);
  }

  async getGroup(id: URN): Promise<ContactGroup | undefined> {
    if (!id) return undefined;
    const storable = await this.db.groups.get(id.toString());
    return storable ? this.groupMapper.toDomain(storable) : undefined;
  }

  async getGroupsByScope(
    scope: 'local' | 'messenger',
  ): Promise<ContactGroup[]> {
    const storables = await this.db.groups
      .where('scope')
      .equals(scope)
      .toArray();
    return storables.map((g) => this.groupMapper.toDomain(g));
  }

  async getGroupsByParent(parentId: URN): Promise<ContactGroup[]> {
    if (!parentId) return [];
    const storables = await this.db.groups
      .where('parentId')
      .equals(parentId.toString())
      .toArray();
    return storables.map((g) => this.groupMapper.toDomain(g));
  }

  async deleteGroup(id: URN): Promise<void> {
    if (!id) return;
    await this.db.groups.delete(id.toString());
  }

  // --- IDENTITY & SECURITY COMMANDS ---

  async linkIdentityToContact(contactId: URN, authUrn: URN): Promise<void> {
    if (!contactId || !authUrn) return;
    await this.db.links.put({
      contactId: contactId.toString(),
      authUrn: authUrn.toString(),
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

  async getGroupsForContact(contactId: URN): Promise<ContactGroup[]> {
    if (!contactId) return [];
    const storables = await this.db.groups
      .where('contactIds')
      .equals(contactId.toString())
      .toArray();
    return storables.map((g) => this.groupMapper.toDomain(g));
  }

  async getContactsForGroup(groupId: URN): Promise<Contact[]> {
    if (!groupId) return [];
    const groupStorable = await this.db.groups.get(groupId.toString());

    if (
      !groupStorable ||
      !groupStorable.contactIds ||
      groupStorable.contactIds.length === 0
    ) {
      return [];
    }

    const storables = await this.db.contacts.bulkGet(groupStorable.contactIds);
    return storables
      .filter((c): c is StorableContact => Boolean(c))
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
