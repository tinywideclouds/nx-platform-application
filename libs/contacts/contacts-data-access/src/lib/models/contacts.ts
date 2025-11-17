import { User, ISODateTimeString, Resource, URN } from '@nx-platform-application/platform-types';

export interface ServiceContact extends Resource {
  alias: string;            // User alias or username specific to that service
  profilePictureUrl?: string; 
  lastSeen: ISODateTimeString; 
}

/**
 * A Contact represents a person in the local address book.
 * It extends the base User identity with local-specific fields.
 * * Architectural Note:
 * This is a PURE native interface. It does not know about Protobufs.
 */
export interface Contact extends User {
  firstName: string;       
  surname: string;

  phoneNumbers: string[];   // E.164 formatted phone numbers
  emailAddresses: string[]; // Verified email addresses (User.email can be the primary)

  // We use Record instead of Map for better JSON serialization 
  // and potential indexing support in Dexie.
  // Key = Service Name (e.g., 'messenger', 'email', 'sip')
  serviceContacts: Record<string, ServiceContact>;
}

export interface ContactGroup extends Resource {
  name: string;
  description?: string;
  contactIds: URN[]; 
}

/**
 * Represents a link between a local Contact and a federated Authentication URN.
 * This allows a single Contact to be associated with multiple providers (Google, Apple, etc.).
 */
export interface IdentityLink {
  id?: number;      // Auto-incrementing ID from Dexie
  contactId: URN;   // The local Contact URN (urn:sm:user:...)
  authUrn: URN;     // The federated Sender URN (urn:auth:provider:...)
}

/**
 * Represents the ServiceContact as it is stored in Dexie
 * (with primitive string IDs).
 */
export interface StorableServiceContact {
  id: string; // <-- Changed from URN
  alias: string;
  profilePictureUrl?: string;
  lastSeen: ISODateTimeString;
}

/**
 * Represents the Contact as it is stored in Dexie
 * (with primitive string IDs).
 */
export interface StorableContact {
  id: string; // <-- Changed from URN
  alias: string;
  email: string;
  firstName: string;
  surname: string;
  phoneNumbers: string[];
  emailAddresses: string[];
  serviceContacts: Record<string, StorableServiceContact>; // <-- Uses storable child
}

/**
 * Represents the ContactGroup as it is stored in Dexie
 * (with primitive string IDs).
 */
export interface StorableGroup {
  id: string; // <-- Changed from URN
  name: string;
  description?: string;
  contactIds: string[]; // <-- Changed from URN[]
}

/**
 * Represents the IdentityLink as it is stored in Dexie
 * (with primitive string IDs).
 */
export interface StorableIdentityLink {
  id?: number;        // Auto-incrementing ID
  contactId: string;  // Stored as string version of URN
  authUrn: string;    // Stored as string version of URN
}