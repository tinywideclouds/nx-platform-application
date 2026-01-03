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

// ✅ NEW: Group Definitions
export type GroupScope = 'local' | 'messenger';
export type GroupMemberStatus =
  | 'added'
  | 'invited'
  | 'joined'
  | 'left'
  | 'removed';

export interface ContactGroupMember {
  contactId: URN;
  status: GroupMemberStatus;
  joinedAt?: ISODateTimeString;
}

export interface ContactGroup extends Resource {
  name: string;
  description?: string;

  // ✅ NEW: Polymorphic Fields
  scope: GroupScope;
  parentId?: URN; // If this is a 'messenger' group, this points to the 'local' template

  // ✅ NEW: Rich Membership
  members: ContactGroupMember[];
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
  scopes: string[];
  reason?: string;
}

export interface ContactTombstone {
  urn: string;
  deletedAt: ISODateTimeString;
}
