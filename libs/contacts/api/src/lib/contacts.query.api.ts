import { URN } from '@nx-platform-application/platform-types';

export interface ContactSummary {
  id: URN;
  alias: string;
  profilePictureUrl?: string;
}

export abstract class ContactsQueryApi {
  abstract getGroupParticipants(groupUrn: URN): Promise<ContactSummary[]>;
  abstract isBlocked(urn: URN, scope: string): Promise<boolean>;
  abstract resolveIdentity(urn: URN): Promise<ContactSummary | null>;
}
