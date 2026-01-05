import { Observable } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';

/**
 * PORT: Address Book (Read Only)
 * Provides reactive access to the User's local data.
 * Used by "Outside" consumers (like Messenger) that need to display contact info
 * but must NOT modify the address book directly.
 */
export abstract class AddressBookApi {
  // --- Reactive Streams ---
  abstract readonly contacts$: Observable<Contact[]>;
  abstract readonly groups$: Observable<ContactGroup[]>;

  // --- Lookups ---
  abstract getContact(id: URN): Promise<Contact | undefined>;
  abstract getGroup(id: URN): Promise<ContactGroup | undefined>;

  /**
   * Used for navigating between Local Groups and their Network Children.
   */
  abstract getGroupsByParent(parentId: URN): Promise<ContactGroup[]>;
}
