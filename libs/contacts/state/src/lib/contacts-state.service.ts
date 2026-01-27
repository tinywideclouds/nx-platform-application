import { Injectable, inject, computed, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { URN } from '@nx-platform-application/platform-types';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { ContactsDomainService } from '@nx-platform-application/contacts-domain-service';

@Injectable({ providedIn: 'root' })
export class ContactsStateService {
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

  private readonly contactMap = computed(() => {
    const map = new Map<string, Contact>();
    this.directory().forEach((c) => map.set(c.id.toString(), c));
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

  getContactSnapshot(urn: URN): Contact | undefined {
    return this.contactMap().get(urn.toString());
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
    alias: string,
    networkId?: URN,
    scope = 'address-book',
  ): Promise<URN> {
    return this.domain.createContact(
      alias,
      networkId ? { urn: networkId, scope } : undefined,
    );
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

  async clearDatabase(): Promise<void> {
    return this.domain.clearDatabase();
  }
}
