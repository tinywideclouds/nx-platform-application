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
  phoneNumber?: string;
  phoneNumbers: string[];
  emailAddresses: string[];
  serviceContacts: Record<string, ServiceContact>;
  lastModified: ISODateTimeString;
}

// Group Definitions
export type GroupScope = 'local' | 'messenger';

export type GroupMemberStatus =
  | 'added'
  | 'invited'
  | 'joined'
  | 'left'
  | 'removed'
  | 'declined';

export type GroupInviteDecision = 'accept' | 'reject';

export interface ContactGroupMember {
  contactId: URN;
  status: GroupMemberStatus;
  joinedAt?: ISODateTimeString;
}

export interface ContactGroup extends Resource {
  name: string;
  description?: string;

  /**
   * Defines the persistence strategy for the group.
   * - 'local': A user-defined distribution list (stored only in local DB).
   * - 'messenger': A network-synced chat group.
   */
  scope: GroupScope;

  /**
   * If this is a 'messenger' group, this ID links back to the 'local' group
   * that acted as the template/origin for the chat.
   */
  parentId?: URN;

  /**
   * Rich membership list containing status and timestamps.
   */
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
