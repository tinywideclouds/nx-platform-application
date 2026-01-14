import {
  Contact,
  ContactGroup,
  PendingIdentity,
  BlockedIdentity,
} from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';

// --- CONSTANTS (Exported for E2E Assertions) ---

export const MOCK_ALICE: Contact = {
  id: URN.parse('urn:contacts:user:alice'),
  alias: 'Alice',
  firstName: 'Alice',
  surname: 'Wonderland',
  email: 'alice@wonderland.com',
  phoneNumbers: ['+15550100'],
  emailAddresses: ['alice@wonderland.com'],
  serviceContacts: {},
  lastModified: new Date().toISOString() as any,
};

export const MOCK_BOB: Contact = {
  id: URN.parse('urn:contacts:user:bob'),
  alias: 'Bob',
  firstName: 'Bob',
  surname: 'Builder',
  email: 'bob@build.com',
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: {},
  lastModified: new Date().toISOString() as any,
};

export const MOCK_GROUP_WORK: ContactGroup = {
  id: URN.parse('urn:contacts:group:work'),
  name: 'Work Friends',
  description: 'Lunch crew distribution list',
  scope: 'local',
  members: [
    {
      contactId: MOCK_ALICE.id,
      status: 'added',
      joinedAt: new Date().toISOString() as any,
    },
    {
      contactId: MOCK_BOB.id,
      status: 'added',
      joinedAt: new Date().toISOString() as any,
    },
  ],
};

export const MOCK_GROUP_PROJECT: ContactGroup = {
  id: URN.parse('urn:contacts:group:project-x'),
  name: 'Project X',
  description: 'Top Secret Network Chat',
  scope: 'messenger',
  members: [
    {
      contactId: MOCK_ALICE.id,
      status: 'joined',
      joinedAt: new Date().toISOString() as any,
    },
  ],
};

export const MOCK_PENDING_STRANGER: PendingIdentity = {
  urn: URN.parse('urn:auth:google:stranger'),
  firstSeenAt: new Date().toISOString() as any,
  note: 'Met at the conference',
};

export const MOCK_BLOCKED_SPAMMER: BlockedIdentity = {
  urn: URN.parse('urn:auth:email:spammer@spam.com'),
  blockedAt: new Date().toISOString() as any,
  scopes: ['messenger'],
  reason: 'Spam',
};

// --- SCENARIO DEFINITIONS ---

export interface ScenarioData {
  contacts: Contact[];
  groups: ContactGroup[];
  pending: PendingIdentity[];
  blocked: BlockedIdentity[];
}

export const SCENARIOS: Record<string, ScenarioData> = {
  empty: {
    contacts: [],
    groups: [],
    pending: [],
    blocked: [],
  },
  populated: {
    contacts: [MOCK_ALICE, MOCK_BOB],
    groups: [MOCK_GROUP_WORK, MOCK_GROUP_PROJECT],
    pending: [MOCK_PENDING_STRANGER],
    blocked: [MOCK_BLOCKED_SPAMMER],
  },
};
