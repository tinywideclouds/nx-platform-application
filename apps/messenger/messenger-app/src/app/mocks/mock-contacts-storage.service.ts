// apps/messenger/messenger-app/src/app/mocks/mock-contacts-storage.service.ts

import { Injectable } from '@angular/core';
import {
  Contact,
  ContactGroup,
  PendingIdentity,
  BlockedIdentity,
  IdentityLink,
} from '@nx-platform-application/contacts-access';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { Observable, of } from 'rxjs';

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
        id: URN.parse('urn:sm:service:msg-alice'),
        alias: 'alice_msg',
        lastSeen: '2025-01-01T12:00:00Z' as ISODateTimeString,
        profilePictureUrl: 'https://i.pravatar.cc/150?img=5',
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
        id: URN.parse('urn:sm:service:msg-bob'),
        alias: 'bobby_b',
        lastSeen: '2025-01-01T12:00:00Z' as ISODateTimeString,
        profilePictureUrl: 'https://i.pravatar.cc/150?img=12',
      },
    },
  },
];

const MOCK_GROUPS: ContactGroup[] = [
  {
    id: URN.parse('urn:sm:group:mock-group-1'),
    name: 'Mock Dev Team',
    description: 'A mock group for testing the UI',
    contactIds: [
      URN.parse('urn:sm:user:mock-contact-1'),
      URN.parse('urn:sm:user:mock-contact-2'),
    ],
  },
];

// --- NEW: Gatekeeper Mocks ---
const MOCK_PENDING: PendingIdentity[] = [
  {
    id: 101,
    urn: URN.parse('urn:auth:google:unknown-stranger'),
    firstSeenAt: '2025-11-17T09:00:00Z' as ISODateTimeString,
  },
  {
    id: 102,
    urn: URN.parse('urn:auth:apple:vouched-friend'),
    firstSeenAt: '2025-11-17T10:00:00Z' as ISODateTimeString,
    vouchedBy: URN.parse('urn:sm:user:mock-contact-2'), // Vouched by Bob
    note: 'This is my friend form the gym',
  },
];

const MOCK_BLOCKED: BlockedIdentity[] = [
  {
    id: 201,
    urn: URN.parse('urn:auth:google:spammer'),
    blockedAt: '2025-11-01T12:00:00Z' as ISODateTimeString,
    reason: 'Spam detected',
  },
];

@Injectable()
export class MockContactsStorageService {
  // --- Streams ---
  readonly contacts$: Observable<Contact[]> = of(MOCK_CONTACTS);
  readonly groups$: Observable<ContactGroup[]> = of(MOCK_GROUPS);

  // New Gatekeeper Streams
  readonly pending$: Observable<PendingIdentity[]> = of(MOCK_PENDING);
  readonly blocked$: Observable<BlockedIdentity[]> = of(MOCK_BLOCKED);

  // --- Core CRUD ---
  async saveContact(contact: Contact): Promise<void> {
    console.log('[MockContacts] Save Contact:', contact);
    return Promise.resolve();
  }

  async getContact(id: URN): Promise<Contact | undefined> {
    return MOCK_CONTACTS.find((c) => c.id.equals(id));
  }

  async saveGroup(group: ContactGroup): Promise<void> {
    console.log('[MockContacts] Save Group:', group);
    return Promise.resolve();
  }

  async getGroup(id: URN): Promise<ContactGroup | undefined> {
    return MOCK_GROUPS.find((g) => g.id.equals(id));
  }

  async getGroupsForContact(contactId: URN): Promise<ContactGroup[]> {
    // Simple mock logic: check if contactId string is in the group's contactIds list
    return MOCK_GROUPS.filter((g) =>
      g.contactIds.some((id) => id.toString() === contactId.toString())
    );
  }

  // --- Linking & Init Support ---

  async getAllIdentityLinks(): Promise<IdentityLink[]> {
    return []; // Empty for now, or could add mock links
  }

  async getAllBlockedIdentityUrns(): Promise<string[]> {
    return MOCK_BLOCKED.map((b) => b.urn.toString());
  }

  async getLinkedIdentities(contactId: URN): Promise<URN[]> {
    // In mock mode, maybe every contact has one identity?
    // For now return empty to keep it simple, or mock it if needed for "Share" test.
    return [];
  }

  // --- Gatekeeper Actions ---

  async addToPending(urn: URN, vouchedBy?: URN, note?: string): Promise<void> {
    console.log('[MockContacts] addToPending:', {
      urn: urn.toString(),
      vouchedBy,
      note,
    });
  }

  async deletePending(urn: URN): Promise<void> {
    console.log('[MockContacts] deletePending:', urn.toString());
  }

  async blockIdentity(urn: URN, reason?: string): Promise<void> {
    console.log('[MockContacts] blockIdentity:', urn.toString(), reason);
  }

  async unblockIdentity(urn: URN): Promise<void> {
    console.log('[MockContacts] unblockIdentity:', urn.toString());
  }
}
