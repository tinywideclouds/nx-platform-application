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

export interface ContactGroup extends Resource {
  name: string;
  description?: string;

  /**
   * Simple list of Contact URNs.
   * We do not hydrate full Contact objects here to keep the domain lightweight.
   */
  memberUrns: URN[];

  lastModified: ISODateTimeString;

  directoryId?: URN; // Optional link to a network group
}

export interface IdentityLink {
  id?: number;
  contactId: URN;
  authUrn: URN;
  scope: string;
}

// Re-export Tombstone
export type ContactTombstone = { urn: string; deletedAt: string };
