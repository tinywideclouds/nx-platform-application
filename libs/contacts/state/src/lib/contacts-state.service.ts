import { Injectable, inject, computed, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ContactSummary } from '@nx-platform-application/contacts-types';

import { URN } from '@nx-platform-application/platform-types';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { ContactsDomainService } from '@nx-platform-application/contacts-domain-service';

import {
  ContactsQueryApi,
  AddressBookApi,
  AddressBookManagementApi,
  SharedIdentityLink,
} from '@nx-platform-application/contacts-api';

@Injectable({ providedIn: 'root' })
export class ContactsStateService
  implements ContactsQueryApi, AddressBookApi, AddressBookManagementApi
{
  private domain = inject(ContactsDomainService);

  // --- RAW STREAMS ---
  readonly contacts$ = this.domain.contacts$;
  readonly groups$ = this.domain.groups$;

  // --- INTERNAL STATE ---
  private readonly directory = toSignal(this.contacts$, {
    initialValue: [] as Contact[],
  });

  // ✅ PUBLIC SIGNALS
  readonly contacts = computed(() => this.directory());

  readonly groups = toSignal(this.groups$, {
    initialValue: [] as ContactGroup[],
  });

  // --- O(1) INDICES ---

  private readonly contactMap = computed(() => {
    const map = new Map<string, Contact>();
    this.directory().forEach((c) => map.set(c.id.toString(), c));
    return map;
  });

  private readonly groupMap = computed(() => {
    const map = new Map<string, ContactGroup>();
    this.groups().forEach((g) => map.set(g.id.toString(), g));
    return map;
  });

  // --- LOOKUP HELPERS ---

  resolveContact(
    urn: URN | string | null | undefined,
  ): Signal<Contact | undefined> {
    return computed(() =>
      urn ? this.contactMap().get(urn.toString()) : undefined,
    );
  }

  resolveContactName(urn: URN | string | null | undefined): Signal<string> {
    const contactSignal = this.resolveContact(urn);
    return computed(() => contactSignal()?.alias || 'Unknown');
  }

  /**
   * Polymorphic Identity Resolver
   * Checks Contacts first, then Groups. Returns Summary for UI.
   */
  async resolveIdentity(urn: URN): Promise<ContactSummary | null> {
    const key = urn.toString();
    const cMap = this.contactMap();
    const gMap = this.groupMap();

    // 1. Try Contact
    const contact = cMap.get(key);
    if (contact) {
      return {
        id: contact.id,
        alias: contact.alias,
        profilePictureUrl:
          contact.serviceContacts['messenger']?.profilePictureUrl,
      };
    }

    // 2. Try Group
    const group = gMap.get(key);
    if (group) {
      return {
        id: group.id,
        alias: group.name,
        profilePictureUrl: undefined,
      };
    }

    return null;
  }

  getContactSnapshot(urn: URN): Contact | undefined {
    return this.contactMap().get(urn.toString());
  }

  /**
   * ✅ NEW: Implements the O(1) Batch Lookup Logic.
   * Handles both Users (Contacts) and Groups (Local).
   */
  async resolveBatch(urns: URN[]): Promise<Map<string, ContactSummary>> {
    console.log('RESOLVING BATCH', urns);
    // We access the signals synchronously (in-memory cache)
    const cMap = this.contactMap();
    const gMap = this.groupMap();
    const result = new Map<string, ContactSummary>();

    for (const urn of urns) {
      const key = urn.toString();

      // 1. Try Contact
      const contact = cMap.get(key);
      if (contact) {
        result.set(key, {
          id: contact.id,
          alias: contact.alias,
          profilePictureUrl:
            contact.serviceContacts['messenger']?.profilePictureUrl,
        });
        continue;
      }

      // 2. Try Group
      const group = gMap.get(key);
      if (group) {
        result.set(key, {
          id: group.id,
          alias: group.name,
          profilePictureUrl: undefined, // Groups might have icons later
        });
      }
    }

    return result;
  }
  /**
   * Resolves member URNs to full Contact objects using the loaded directory.
   */
  async getGroupParticipants(groupUrn: URN): Promise<Contact[]> {
    const group = await this.domain.getGroup(groupUrn);
    if (!group || !group.memberUrns) return [];

    const allContacts = this.contactMap();
    return group.memberUrns
      .map((urn) => allContacts.get(urn.toString()))
      .filter((c): c is Contact => !!c);
  }

  // --- GROUP ACTIONS ---

  async createGroup(
    name: string,
    description: string,
    memberUrns: URN[],
  ): Promise<URN> {
    return this.domain.createGroup(name, description, memberUrns);
  }

  /**
   * ✅ RESTORED: Required by ContactGroupPageComponent for updates
   */
  async saveGroup(group: ContactGroup): Promise<void> {
    return this.domain.saveGroup(group);
  }

  async getGroup(urn: URN): Promise<ContactGroup | undefined> {
    return this.domain.getGroup(urn);
  }

  /**
   * ✅ RESTORED: Required by ContactGroupPageComponent for hierarchy
   */
  async getGroupsByParent(parentId: URN): Promise<ContactGroup[]> {
    return this.domain.getGroupsByParent(parentId);
  }

  async getGroupsForContact(contactUrn: URN): Promise<ContactGroup[]> {
    return this.domain.getGroupsForContact(contactUrn);
  }

  async deleteGroup(id: URN): Promise<void> {
    return this.domain.deleteGroup(id);
  }

  async getGroupMetadata(urn: URN): Promise<{ memberCount: number }> {
    return this.domain.getGroupMetadata(urn);
  }

  // --- CONTACT ACTIONS ---

  async createContact(
    email: string,
    alias: string,
    name?: string,
    surname?: string,
    scope: string = 'address-book',
  ): Promise<Contact> {
    return this.domain.createContact(alias, email);
  }

  async saveContact(contact: Contact): Promise<void> {
    return this.domain.saveContact(contact);
  }

  async deleteContact(id: URN): Promise<void> {
    return this.domain.deleteContact(id);
  }

  async getContact(urn: URN): Promise<Contact | undefined> {
    return this.domain.getContact(urn);
  }

  async getLinkedIdentities(urn: URN): Promise<URN[]> {
    return this.domain.getLinkedIdentities(urn);
  }

  /**
   * ✅ FAIL FAST: Not yet supported by Domain Service
   */
  async linkIdentity(localUrn: URN, link: SharedIdentityLink): Promise<void> {
    throw new Error('Method not implemented: linkIdentity');
  }

  async clearDatabase(): Promise<void> {
    return this.domain.clearDatabase();
  }
}
