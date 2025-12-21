import {
  User,
  ISODateTimeString,
  Resource,
  URN,
} from '@nx-platform-application/platform-types';

export interface ServiceContact extends Resource {
  alias: string;
  profilePictureUrl?: string;
  lastSeen: ISODateTimeString;
}

export interface Contact extends User {
  firstName: string;
  surname: string;
  phoneNumbers: string[];
  emailAddresses: string[];
  serviceContacts: Record<string, ServiceContact>;
  lastModified: ISODateTimeString;
}

export interface ContactGroup extends Resource {
  name: string;
  description?: string;
  contactIds: URN[];
}

export interface IdentityLink {
  id?: number;
  contactId: URN;
  authUrn: URN;
}

export interface PendingIdentity {
  id?: number;
  urn: URN;
  firstSeenAt: ISODateTimeString;
  vouchedBy?: URN;
  note?: string;
}

export interface BlockedIdentity {
  id?: number;
  urn: URN;
  blockedAt: ISODateTimeString;
  scopes: string[]; // e.g. ['all'] or ['messenger', 'calls']
  reason?: string;
}

export interface ContactTombstone {
  urn: string;
  deletedAt: ISODateTimeString;
}
