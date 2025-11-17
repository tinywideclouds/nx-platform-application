// apps/messenger/messenger-app/src/app/mocks/mock-contacts-storage.service.ts

import { Injectable } from '@angular/core';
import {
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { ISODateTimeString, URN } from '@nx-platform-application/platform-types'; // <-- 1. Import URN
import { Observable, of } from 'rxjs';

// --- 2. Update Mock Data to use URN.parse() ---

const MOCK_CONTACTS: Contact[] = [
  {
    id: URN.parse('urn:sm:user:mock-contact-1'), // <-- FIX
    alias: 'Alice (Mock)',
    firstName: 'Alice',
    surname: 'Anderson',
    email: 'alice@mock.com',
    phoneNumbers: ['+15550001'],
    emailAddresses: ['alice@mock.com'],
    serviceContacts: {
      messenger: {
        id: URN.parse('urn:sm:service:msg-alice'), // <-- FIX
        alias: 'alice_msg',
        lastSeen: '2025-01-01T12:00:00Z' as ISODateTimeString,
        profilePictureUrl: 'https://i.pravatar.cc/150?img=5',
      },
    },
  },
  {
    id: URN.parse('urn:sm:user:mock-contact-2'), // <-- FIX
    alias: 'Bob (Mock)',
    firstName: 'Bob',
    surname: 'Brown',
    email: 'bob@mock.com',
    phoneNumbers: ['+15550002'],
    emailAddresses: ['bob@mock.com'],
    serviceContacts: {
      messenger: {
        id: URN.parse('urn:sm:service:msg-bob'), // <-- FIX
        alias: 'bobby_b',
        lastSeen: '2025-01-01T12:00:00Z' as ISODateTimeString,
        profilePictureUrl: 'https://i.pravatar.cc/150?img=12',
      },
    },
  },
  {
    id: URN.parse('urn:sm:user:mock-contact-3'), // <-- FIX
    alias: 'Charlie (Mock)',
    firstName: 'Charlie',
    surname: 'Davis',
    email: 'charlie@mock.com',
    phoneNumbers: ['+15550003'],
    emailAddresses: ['charlie@mock.com'],
    serviceContacts: {
      messenger: {
        id: URN.parse('urn:sm:service:msg-charlie'), // <-- FIX
        alias: 'cdavis',
        lastSeen: '2025-01-01T12:00:00Z' as ISODateTimeString,
      },
    },
  },
];

const MOCK_GROUPS: ContactGroup[] = [
  {
    id: URN.parse('urn:sm:group:mock-group-1'), // <-- FIX
    name: 'Mock Dev Team',
    description: 'A mock group for testing the UI',
    contactIds: [
      URN.parse('urn:sm:user:mock-contact-1'), // <-- FIX
      URN.parse('urn:sm:user:mock-contact-2'), // <-- FIX
    ],
  },
  {
    id: URN.parse('urn:sm:group:mock-group-2'), // <-- FIX
    name: 'Weekend Plans',
    description: '',
    contactIds: [
      URN.parse('urn:sm:user:mock-contact-1'), // <-- FIX
      URN.parse('urn:sm:user:mock-contact-3'), // <-- FIX
    ],
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

  async saveContact(contact: Contact): Promise<void> {
    console.log('[MockContactsStorageService] Save Contact:', contact);
    return Promise.resolve();
  }

  async getContact(id: URN): Promise<Contact | undefined> {
    console.log('[MockContactsStorageService] Get Contact:', id);
    // --- 3. Fix comparison logic ---
    return MOCK_CONTACTS.find((c) => c.id.equals(id));
  }

  async saveGroup(group: ContactGroup): Promise<void> {
    console.log('[MockContactsStorageService] Save Group:', group);
    return Promise.resolve();
  }

  // --- 4. Fix method signature and comparison logic ---
  async getGroup(id: URN): Promise<ContactGroup | undefined> {
    console.log('[MockContactsStorageService] Get Group:', id);
    return MOCK_GROUPS.find((g) => g.id.equals(id));
  }
}