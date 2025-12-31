import { URN } from '@nx-platform-application/platform-types';

export interface ContactSummary {
  id: URN;
  alias: string;
  profilePictureUrl?: string;
}

export interface ContactsQueryApi {
  getGroupParticipants(groupUrn: URN): Promise<ContactSummary[]>;
  isBlocked(urn: URN, scope: string): Promise<boolean>;
  resolveIdentity(urn: URN): Promise<ContactSummary | null>;
}
