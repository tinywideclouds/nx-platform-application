import { User, ISODateTimeString } from '@nx-platform-application/platform-types';

export interface ServiceContact {
  id: string;               // Unique service contact ID (e.g., the messenger UUID)
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

export interface ContactGroup {
  id: string; 
  name: string;
  description?: string;
  contactIds: string[]; 
}