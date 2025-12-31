import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { Contact } from '@nx-platform-application/contacts-types';
import { ContactSummary, ContactsQueryApi } from './models';

@Injectable({ providedIn: 'root' })
export class ContactsFacadeService implements ContactsQueryApi {
  // The Facade wraps the internal State implementation to provide
  // a clean, DTO-based contract to external consumers.
  private state = inject(ContactsStateService);

  async getGroupParticipants(groupUrn: URN): Promise<ContactSummary[]> {
    const contacts = await this.state.getGroupParticipants(groupUrn);
    return contacts.map((c) => this.toSummary(c));
  }

  async isBlocked(urn: URN, scope: string): Promise<boolean> {
    return this.state.isTrusted(urn, scope).then((trusted) => !trusted);
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
        contact.serviceContacts?.['messenger']?.profilePictureUrl, // Optional chaining is safe here
    };
  }
}
