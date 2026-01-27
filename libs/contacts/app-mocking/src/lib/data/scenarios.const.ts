import {
  Contact,
  ContactGroup,
  PendingIdentity,
  BlockedIdentity,
} from '@nx-platform-application/contacts-types';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Temporal } from '@js-temporal/polyfill';

import {
  idAliceContact,
  idBobContact,
  idBobMessenger,
  groupWork as dirGroupWork,
} from '@nx-platform-application/directory-app-mocking';

const now = Temporal.Now.instant().toString() as ISODateTimeString;

// --- Contacts ---

export const mockAlice: Contact = {
  id: idAliceContact,
  alias: 'Alice (Work)',
  firstName: 'Alice',
  surname: 'Wonderland',
  email: 'alice@wonderland.com',
  phoneNumbers: ['+15550100'],
  emailAddresses: ['alice@wonderland.com'],
  serviceContacts: {},
  lastModified: now,
};

export const mockBob: Contact = {
  id: idBobContact,
  alias: 'Bob (Builder)',
  firstName: 'Bob',
  surname: 'Builder',
  email: 'bob@build.com',
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: {},
  lastModified: now,
};

// --- Groups ---

export const mockGroupWork: ContactGroup = {
  id: URN.parse('urn:contacts:group:work'),
  directoryId: dirGroupWork.id,
  name: 'Work Friends',
  description: 'Lunch crew distribution list',
  // ✅ FIX: Actually added the members!
  memberUrns: [idAliceContact, idBobContact],
  lastModified: now,
};

// --- Scenario Data ---

export interface IdentityLinkMock {
  contactId: URN;
  authUrn: URN;
  scope: string;
}

export interface ScenarioData {
  contacts: Contact[];
  groups: ContactGroup[];
  links: IdentityLinkMock[];
  pending: PendingIdentity[];
  blocked: BlockedIdentity[];
}

export const scenarios: Record<string, ScenarioData> = {
  empty: {
    contacts: [],
    groups: [],
    links: [],
    pending: [],
    blocked: [],
  },
  populated: {
    contacts: [mockAlice, mockBob],
    groups: [mockGroupWork],
    links: [
      {
        contactId: mockBob.id,
        authUrn: idBobMessenger,
        scope: 'messenger',
      },
    ],
    pending: [],
    blocked: [],
  },
};
