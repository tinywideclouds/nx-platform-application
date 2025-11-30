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

// ✅ NEW: Sync Logic
export interface ContactTombstone {
  urn: string;
  deletedAt: ISODateTimeString;
}

// --- STORABLE MODELS (Primitives) ---

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
  serviceContacts: Record<string, StorableServiceContact>;
  // ✅ NEW: Sync Metadata
  lastModified: ISODateTimeString;
}

export interface StorableGroup {
  id: string;
  name: string;
  description?: string;
  contactIds: string[];
}

export interface StorableIdentityLink {
  id?: number;
  contactId: string;
  authUrn: string;
}

export interface StorablePendingIdentity {
  id?: number;
  urn: string;
  firstSeenAt: ISODateTimeString;
  vouchedBy?: string;
  note?: string;
}
