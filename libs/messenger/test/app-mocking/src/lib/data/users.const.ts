import {
  ISODateTimeString,
  URN,
  User,
} from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-types';
import { Temporal } from '@js-temporal/polyfill';

export const MESSENGER_USERS = {
  ME: URN.parse('urn:contacts:user:me'),
  ALICE: URN.parse('urn:contacts:user:alice'),
  BOB: URN.parse('urn:contacts:user:bob'),
  SPAMMER: URN.parse('urn:contacts:user:spammer'),
};

export const DEFAULT_USER: User = {
  id: MESSENGER_USERS.ME,
  alias: 'Me',
  email: 'me@example.com',
};

// --- CONTACT DEFINITIONS ---

export const CONTACT_ALICE: Contact = {
  id: MESSENGER_USERS.ALICE,
  alias: 'Alice',
  firstName: 'Alice',
  surname: 'Wonderland',
  email: 'alice@example.com',
  phoneNumbers: [],
  emailAddresses: ['alice@example.com'],
  // Linked to Messenger Service
  serviceContacts: {
    messenger: {
      id: MESSENGER_USERS.ALICE,
      alias: 'Alice',
      lastSeen: Temporal.Now.instant().toString() as ISODateTimeString,
    },
  },
  lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
};

export const CONTACT_BOB: Contact = {
  id: MESSENGER_USERS.BOB,
  alias: 'Bob',
  firstName: 'Bob',
  surname: 'Builder',
  email: 'bob@example.com',
  phoneNumbers: [],
  emailAddresses: ['bob@example.com'],
  // Linked to Messenger Service
  serviceContacts: {
    messenger: {
      id: MESSENGER_USERS.BOB,
      alias: 'Bob',
      lastSeen: Temporal.Now.instant().toString() as ISODateTimeString,
    },
  },
  lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
};
