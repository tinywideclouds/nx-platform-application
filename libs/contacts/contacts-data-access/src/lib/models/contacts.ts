import { User, ISODateTimeString, Resource, URN } from '@nx-platform-application/platform-types';

export interface ServiceContact extends Resource {
  alias: string;            // User alias or username specific to that service
  profilePictureUrl?: string; 
  lastSeen: ISODateTimeString; 
}

/**
 * A Contact represents a person in the local address book.
 * It extends the base User identity with local-specific fields.
 */
export interface Contact extends User {
  firstName: string;       
  surname: string;

  phoneNumbers: string[];   // E.164 formatted phone numbers
  emailAddresses: string[]; // Verified email addresses

  serviceContacts: Record<string, ServiceContact>;
}

export interface ContactGroup extends Resource {
  name: string;
  description?: string;
  contactIds: URN[]; 
}

/**
 * Represents a link between a local Contact and a federated Authentication URN.
 */
export interface IdentityLink {
  id?: number;      // Auto-incrementing ID from Dexie
  contactId: URN;   // The local Contact URN (urn:sm:user:...)
  authUrn: URN;     // The federated Sender URN (urn:auth:provider:...)
}

// --- GATEKEEPER MODELS ---

/**
 * Represents an Authentication URN that has been explicitly blocked.
 * Messages from this URN will be silently dropped.
 */
export interface BlockedIdentity {
  id?: number;
  urn: URN;                    // The Sender URN to block
  blockedAt: ISODateTimeString;
  reason?: string;
}

/**
 * The "Waiting Room".
 * Represents an identity that has contacted us (or been introduced)
 * but is not yet a trusted Contact or explicitly Blocked.
 */
export interface PendingIdentity {
  id?: number;
  urn: URN;                    // The Stranger's URN
  firstSeenAt: ISODateTimeString;
  
  // If present, this person was introduced by a trusted contact.
  // If missing, this is a random "Unknown Sender".
  vouchedBy?: URN;             
  note?: string;               // "This is my cousin June"
}

// --- Storable Models (Primitives) ---

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

export interface StorableBlockedIdentity {
  id?: number;
  urn: string;
  blockedAt: ISODateTimeString;
  reason?: string;
}

/**
 * Storable version of PendingIdentity.
 */
export interface StorablePendingIdentity {
  id?: number;
  urn: string;                 // Indexed
  firstSeenAt: ISODateTimeString;
  vouchedBy?: string;          // Indexed (optional)
  note?: string;
}