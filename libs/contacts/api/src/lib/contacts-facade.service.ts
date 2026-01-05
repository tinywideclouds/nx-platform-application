import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import {
  Contact,
  ContactGroup,
  BlockedIdentity,
  PendingIdentity,
} from '@nx-platform-application/contacts-types';
import { ContactsStateService } from '@nx-platform-application/contacts-state';

import { ContactsQueryApi, ContactSummary } from './contacts.query.api';
import { AddressBookApi } from './address-book.api';
import { AddressBookManagementApi } from './address-book-management.api';
import { GatekeeperApi } from './gatekeeper.api';

@Injectable({ providedIn: 'root' })
export class ContactsFacadeService
  implements
    ContactsQueryApi,
    AddressBookApi,
    AddressBookManagementApi,
    GatekeeperApi
{
  private state = inject(ContactsStateService);

  // === AddressBookApi (Read-Only) ===

  readonly contacts$: Observable<Contact[]> = this.state.contacts$;
  readonly groups$: Observable<ContactGroup[]> = this.state.groups$;

  async getContact(id: URN): Promise<Contact | undefined> {
    return this.state.getContact(id);
  }

  async getGroup(id: URN): Promise<ContactGroup | undefined> {
    return this.state.getGroup(id);
  }

  async getGroupsByParent(parentId: URN): Promise<ContactGroup[]> {
    return this.state.getGroupsByParent(parentId);
  }

  // === AddressBookManagementApi (Write Access) ===

  async saveContact(contact: Contact): Promise<void> {
    return this.state.saveContact(contact);
  }

  async saveGroup(group: ContactGroup): Promise<void> {
    return this.state.saveGroup(group);
  }

  async createContact(alias: string, networkId?: URN): Promise<URN> {
    return this.state.createContact(alias, networkId);
  }

  async clearData(): Promise<void> {
    return this.state.clearDatabase();
  }

  // === GatekeeperApi (Security) ===

  readonly blocked$: Observable<BlockedIdentity[]> = this.state.blocked$;
  readonly pending$: Observable<PendingIdentity[]> = this.state.pending$;

  async blockIdentity(
    urn: URN,
    scopes: string[],
    reason?: string,
  ): Promise<void> {
    // State handles the orchestration (blocking + deleting pending)
    return this.state.blockIdentity(urn, scopes);
  }

  async unblockIdentity(urn: URN): Promise<void> {
    return this.state.unblockIdentity(urn);
  }

  async getAllBlockedIdentities(): Promise<BlockedIdentity[]> {
    // Return the current snapshot from the State signal
    return Promise.resolve(this.state.blocked());
  }

  async addToPending(urn: URN, vouchedBy?: URN, note?: string): Promise<void> {
    return this.state.addToPending(urn, vouchedBy, note);
  }

  async getPendingIdentity(urn: URN): Promise<PendingIdentity | null> {
    return this.state.getPendingIdentity(urn);
  }

  async deletePending(urn: URN): Promise<void> {
    return this.state.deletePending(urn);
  }

  // === ContactsQueryApi (Legacy/Adapter) ===

  async getGroupParticipants(groupUrn: URN): Promise<ContactSummary[]> {
    const contacts = await this.state.getGroupParticipants(groupUrn);
    return contacts.map((c) => this.toSummary(c));
  }

  async isBlocked(urn: URN, scope: string): Promise<boolean> {
    return this.state.isBlocked(urn, scope);
  }

  async resolveIdentity(urn: URN): Promise<ContactSummary | null> {
    const contact = this.state.getContactSnapshot(urn);
    return contact ? this.toSummary(contact) : null;
  }

  private toSummary(contact: Contact): ContactSummary {
    return {
      id: contact.id,
      alias: contact.alias,
      profilePictureUrl:
        contact.serviceContacts?.['messenger']?.profilePictureUrl,
    };
  }
}
