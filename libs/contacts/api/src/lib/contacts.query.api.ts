import { URN } from '@nx-platform-application/platform-types';

export interface ContactSummary {
  id: URN;
  alias: string;
  profilePictureUrl?: string;
}

/**
 * CONTRACT & TOKEN
 * Abstract class pattern allows this to be used as both an Interface and an Injection Token.
 * This decouples the consumer (Messenger) from the implementation (Storage).
 */
export abstract class ContactsQueryApi {
  abstract getGroupParticipants(groupUrn: URN): Promise<ContactSummary[]>;
  abstract isBlocked(urn: URN, scope: string): Promise<boolean>;
  abstract resolveIdentity(urn: URN): Promise<ContactSummary | null>;
}
