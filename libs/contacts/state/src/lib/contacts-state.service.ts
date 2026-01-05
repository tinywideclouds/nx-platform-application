import { Injectable, inject, computed, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Temporal } from '@js-temporal/polyfill';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  Contact,
  ContactGroup,
  IdentityLink,
  BlockedIdentity,
  PendingIdentity,
} from '@nx-platform-application/contacts-types';

import {
  ContactsStorageService,
  GatekeeperStorage,
} from '@nx-platform-application/contacts-storage';

@Injectable({ providedIn: 'root' })
export class ContactsStateService {
  private storage = inject(ContactsStorageService);
  private gatekeeper = inject(GatekeeperStorage);

  // --- RAW OBSERVABLES (For Facade/API) ---
  readonly contacts$ = this.storage.contacts$;
  readonly groups$ = this.storage.groups$;
  readonly blocked$ = this.gatekeeper.blocked$;
  readonly pending$ = this.gatekeeper.pending$;

  // --- SIGNALS (Source of Truth for UI) ---
  readonly contacts = toSignal(this.contacts$, {
    initialValue: [] as Contact[],
  });

  readonly favorites = toSignal(this.storage.favorites$, {
    initialValue: [] as Contact[],
  });

  readonly groups = toSignal(this.groups$, {
    initialValue: [] as ContactGroup[],
  });

  readonly blocked = toSignal(this.blocked$, {
    initialValue: [] as BlockedIdentity[],
  });

  readonly pending = toSignal(this.pending$, {
    initialValue: [] as PendingIdentity[],
  });

  private readonly contactMap = computed(() => {
    const map = new Map<string, Contact>();
    for (const c of this.contacts()) {
      map.set(c.id.toString(), c);
    }
    return map;
  });

  // --- Lookups ---

  resolveContact(
    urn: URN | string | null | undefined,
  ): Signal<Contact | undefined> {
    return computed(() => {
      if (!urn) return undefined;
      const idStr = urn.toString();
      return this.contactMap().get(idStr);
    });
  }

  getContactSnapshot(urn: URN): Contact | undefined {
    return this.contactMap().get(urn.toString());
  }

  resolveContactName(urn: URN | string | null | undefined): Signal<string> {
    return computed(() => {
      if (!urn) return 'Unknown';
      const idStr = urn.toString();
      const contact = this.contactMap().get(idStr);
      if (contact) {
        return contact.alias || contact.firstName || 'Unknown Contact';
      }
      return this.formatUnknownUrn(idStr);
    });
  }

  // --- API Support Methods ---

  async isBlocked(urn: URN, scope: string): Promise<boolean> {
    const idStr = urn.toString();
    const allBlocked = this.blocked();
    return allBlocked.some(
      (b) =>
        b.urn.toString() === idStr &&
        (b.scopes.includes('all') || b.scopes.includes(scope)),
    );
  }

  async isTrusted(urn: URN, scope: string = 'messenger'): Promise<boolean> {
    const idStr = urn.toString();
    const isInContacts = this.contactMap().has(idStr);

    if (!isInContacts) {
      return false;
    }

    const blocked = await this.isBlocked(urn, scope);
    return !blocked;
  }

  // --- Factory Methods (Domain Logic) ---

  async createContact(alias: string, networkId?: URN): Promise<URN> {
    const uuid = crypto.randomUUID();
    const localId = URN.create('user', uuid, 'contacts');

    const parts = alias.trim().split(' ');
    const firstName = parts[0] || alias;
    const surname = parts.length > 1 ? parts.slice(1).join(' ') : '';
    const now = Temporal.Now.instant().toString() as ISODateTimeString;

    const newContact: Contact = {
      id: localId,
      alias: alias,
      email: '',
      firstName,
      surname,
      emailAddresses: [],
      phoneNumbers: [],
      serviceContacts: {},
      lastModified: now,
    };

    if (networkId) {
      newContact.serviceContacts['messenger'] = {
        id: networkId,
        alias: '',
        lastSeen: now,
      };
    }

    await this.storage.saveContact(newContact);
    return localId;
  }

  // --- Orchestration ---

  async getGroupParticipants(groupUrn: URN): Promise<Contact[]> {
    return this.storage.getContactsForGroup(groupUrn);
  }

  // --- Delegation (To Storage) ---

  async saveContact(contact: Contact): Promise<void> {
    await this.storage.saveContact(contact);
  }

  async deleteContact(id: URN): Promise<void> {
    await this.storage.deleteContact(id);
  }

  async saveGroup(group: ContactGroup): Promise<void> {
    await this.storage.saveGroup(group);
  }

  async deleteGroup(id: URN): Promise<void> {
    await this.storage.deleteGroup(id);
  }

  async getGroupsByParent(parentId: URN): Promise<ContactGroup[]> {
    return this.storage.getGroupsByParent(parentId);
  }

  async getGroupsForContact(contactId: URN): Promise<ContactGroup[]> {
    return this.storage.getGroupsForContact(contactId);
  }

  async getLinkedIdentities(contactId: URN): Promise<URN[]> {
    return this.storage.getLinkedIdentities(contactId);
  }

  // --- Gatekeeper Delegation ---

  async blockIdentity(urn: URN, scopes: string[] = ['all']): Promise<void> {
    await this.gatekeeper.blockIdentity(urn, scopes);
    await this.gatekeeper.deletePending(urn);
  }

  async unblockIdentity(urn: URN): Promise<void> {
    await this.gatekeeper.unblockIdentity(urn);
  }

  async deletePending(urn: URN): Promise<void> {
    await this.gatekeeper.deletePending(urn);
  }

  async addToPending(urn: URN, vouchedBy?: URN, note?: string): Promise<void> {
    await this.gatekeeper.addToPending(urn, vouchedBy, note);
  }

  async getPendingIdentity(urn: URN): Promise<PendingIdentity | null> {
    return this.gatekeeper.getPendingIdentity(urn);
  }

  async getAllIdentityLinks(): Promise<IdentityLink[]> {
    return this.storage.getAllIdentityLinks();
  }

  async clearDatabase(): Promise<void> {
    await this.storage.clearDatabase();
  }

  async performContactsWipe(): Promise<void> {
    await this.storage.clearAllContacts();
  }

  async getContact(id: URN): Promise<Contact | undefined> {
    return this.storage.getContact(id);
  }

  async getGroup(id: URN): Promise<ContactGroup | undefined> {
    return this.storage.getGroup(id);
  }

  private formatUnknownUrn(str: string): string {
    const id = str.includes(':') ? str.split(':').pop()! : str;
    if (id.length === 36 && id.includes('-')) {
      return `User ${id.slice(-4).toUpperCase()}`;
    }
    return id;
  }
}
