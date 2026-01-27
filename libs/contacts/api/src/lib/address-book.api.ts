import { Observable } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';

/**
 * PORT: Address Book (Read Only)
 * Provides reactive access to the User's local data.
 */
export abstract class AddressBookApi {
  // --- Reactive Streams ---
  abstract readonly contacts$: Observable<Contact[]>;
  abstract readonly groups$: Observable<ContactGroup[]>;

  // --- Lookups ---
  abstract getContact(id: URN): Promise<Contact | undefined>;
  abstract getGroup(id: URN): Promise<ContactGroup | undefined>;

  abstract getGroupsByParent(parentId: URN): Promise<ContactGroup[]>;
}
