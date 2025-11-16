import { Injectable } from '@angular/core';
import {
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { Observable, of } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';

// --- Mock Data ---

const MOCK_CONTACTS: Contact[] = [
  {
    id: URN.parse('urn:sm:user:mock-contact-1'),
    alias: 'Alice (Mock)',
    firstName: 'Alice',
    surname: 'Anderson',
    email: 'alice@mock.com',
    phoneNumbers: ['+15550001'],
    emailAddresses: ['alice@mock.com'],
    serviceContacts: {
      messenger: {
        id: 'msg-alice',
        alias: 'alice_msg',
        lastSeen: '2025-01-01T12:00:00Z' as ISODateTimeString,
        profilePictureUrl: 'https://i.pravatar.cc/150?img=5', // Placeholder image
      },
    },
  },
  {
    id: URN.parse('urn:sm:user:mock-contact-2'),
    alias: 'Bob (Mock)',
    firstName: 'Bob',
    surname: 'Brown',
    email: 'bob@mock.com',
    phoneNumbers: ['+15550002'],
    emailAddresses: ['bob@mock.com'],
    serviceContacts: {
      messenger: {
        id: 'msg-bob',
        alias: 'bobby_b',
        lastSeen: '2025-01-01T12:00:00Z' as ISODateTimeString,
        profilePictureUrl: 'https://i.pravatar.cc/150?img=12', // Placeholder image
      },
    },
  },
  {
    id: URN.parse('urn:sm:user:mock-contact-3'),
    alias: 'Charlie (Mock)',
    firstName: 'Charlie',
    surname: 'Davis',
    email: 'charlie@mock.com',
    phoneNumbers: ['+15550003'],
    emailAddresses: ['charlie@mock.com'],
    serviceContacts: {
      messenger: {
        id: 'msg-charlie',
        alias: 'cdavis',
        lastSeen: '2025-01-01T12:00:00Z' as ISODateTimeString,
      },
    },
  },
];

const MOCK_GROUPS: ContactGroup[] = [
  {
    id: 'urn:sm:group:mock-group-1',
    name: 'Mock Dev Team',
    description: 'A mock group for testing the UI',
    contactIds: ['urn:sm:user:mock-contact-1', 'urn:sm:user:mock-contact-2'],
  },
  {
    id: 'urn:sm:group:mock-group-2',
    name: 'Weekend Plans',
    description: '',
    contactIds: ['urn:sm:user:mock-contact-1', 'urn:sm:user:mock-contact-3'],
  },
];

/**
 * Provides a mock implementation of the ContactsStorageService.
 * This service is provided in app.config.ts when environment.useMocks is true.
 */
@Injectable()
export class MockContactsStorageService {
  /**
   * Emits a static array of mock contacts.
   */
  readonly contacts$: Observable<Contact[]> = of(MOCK_CONTACTS);

  /**
   * Emits a static array of mock groups.
   */
  readonly groups$: Observable<ContactGroup[]> = of(MOCK_GROUPS);

  // --- Mock other public methods (if any) ---
  // We can add mocks for saveContact, getContact, etc.
  // as needed, but for now, the UI only needs the observables.

  async saveContact(contact: Contact): Promise<void> {
    console.log('[MockContactsStorageService] Save Contact:', contact);
    return Promise.resolve();
  }

  async getContact(id: URN): Promise<Contact | undefined> {
    console.log('[MockContactsStorageService] Get Contact:', id);
    return MOCK_CONTACTS.find((c) => c.id === id);
  }

  async saveGroup(group: ContactGroup): Promise<void> {
    console.log('[MockContactsStorageService] Save Group:', group);
    return Promise.resolve();
  }

  async getGroup(id: string): Promise<ContactGroup | undefined> {
    console.log('[MockContactsStorageService] Get Group:', id);
    return MOCK_GROUPS.find((g) => g.id === id);
  }
}