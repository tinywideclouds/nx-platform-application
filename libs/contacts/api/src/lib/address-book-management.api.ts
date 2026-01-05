import { URN } from '@nx-platform-application/platform-types';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';

/**
 * PORT: Address Book Management (Write Access)
 * Provides modification capabilities for the User's local data.
 * Consumed by: Group Protocol, Edit Contact Page, New Group Wizard.
 */
export abstract class AddressBookManagementApi {
  abstract saveContact(contact: Contact): Promise<void>;
  abstract saveGroup(group: ContactGroup): Promise<void>;

  /**
   * Factory method to create a new contact from minimal information.
   * Handles Local URN generation and optional Network Identity linking.
   *
   * @param alias The display name for the contact
   * @param networkId (Optional) The Network URN (urn:identity:...) to link immediately.
   * Used for "Promote Guest" or "Save Shared Contact" flows.
   * @returns The newly created Local Contact URN (urn:contacts:...)
   */
  abstract createContact(alias: string, networkId?: URN): Promise<URN>;

  /**
   * Wipes all address book data (Contacts, Groups, Links).
   * Used during Device Wipe / Logout.
   */
  abstract clearData(): Promise<void>;
}
