import { ISODateTimeString } from '@nx-platform-application/platform-types';

export interface StorableServiceContact {
  id: string;
  alias: string;
  profilePictureUrl?: string;
  lastSeen: ISODateTimeString;
}

export interface StorableContact {
  id: string;
  alias: string;
  email: string;
  firstName: string;
  surname: string;
  phoneNumbers: string[];
  emailAddresses: string[];
  lastModified: ISODateTimeString;
}

export interface StorableIdentityLink {
  id?: number;
  contactId: string;
  authUrn: string;
  scope: string;
}

export interface StorablePendingIdentity {
  id?: number;
  urn: string;
  firstSeenAt: ISODateTimeString;
  vouchedBy?: string;
  note?: string;
}

export interface StorableBlockedIdentity {
  id?: number;
  urn: string;
  blockedAt: ISODateTimeString;
  scopes: string[];
  reason?: string;
}
