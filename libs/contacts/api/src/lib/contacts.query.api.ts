import { URN } from '@nx-platform-application/platform-types';

import {
  Contact,
  ContactSummary,
} from '@nx-platform-application/contacts-types';

/**
 * CONTRACT & TOKEN
 * Abstract class pattern allows this to be used as both an Interface and an Injection Token.
 * This decouples the consumer (Messenger) from the implementation (Storage).
 */
export abstract class ContactsQueryApi {
  /**
   * Resolves a Group URN (urn:contacts:group:*) to a list of participants.
   */
  abstract getGroupParticipants(groupUrn: URN): Promise<Contact[]>;

  abstract resolveIdentity(urn: URN): Promise<ContactSummary | null>;

  abstract resolveBatch(urns: URN[]): Promise<Map<string, ContactSummary>>;
}
