import { URN } from '@nx-platform-application/platform-types';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';

export interface SharedIdentityLink {
  // The pointer to the Directory
  directoryUrn: URN;
  // User's specific overrides for this context
  label?: string; // e.g., "Work Chat" vs default "Generic Group"
}

export abstract class AddressBookManagementApi {
  // 1. Persistence
  abstract saveContact(contact: Contact): Promise<void>;

  // 2. Group Management
  abstract saveGroup(group: ContactGroup): Promise<void>;

  /**
   * Links a Local Contact to a Global Directory URN.
   * Used when "Upgrading" a stranger to a friend.
   */
  abstract linkIdentity(localUrn: URN, link: SharedIdentityLink): Promise<void>;

  abstract clearDatabase(): Promise<void>;
}
