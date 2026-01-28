import {
  ISODateTimeString,
  URN,
  userFromPb,
} from '@nx-platform-application/platform-types';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { Temporal } from '@js-temporal/polyfill';
import { MessengerScenarioData } from '../types';
import {
  DEFAULT_USER,
  MESSENGER_USERS,
  CONTACT_ALICE,
  CONTACT_BOB,
} from '../data/users.const';

import { EntityTypeUser } from '@nx-platform-application/directory-types';

const now = Temporal.Now.instant().toString() as ISODateTimeString;

const USER_CHARLIE = URN.parse('urn:contacts:user:charlie');
const USER_DAVE = URN.parse('urn:contacts:user:dave');

const CONTACT_CHARLIE: Contact = {
  id: USER_CHARLIE,
  alias: 'Charlie',
  firstName: 'Charlie',
  surname: 'Bucket',
  email: 'charlie@example.com',
  phoneNumbers: [],
  emailAddresses: ['charlie@example.com'],
  serviceContacts: {
    messenger: { id: USER_CHARLIE, alias: 'Charlie', lastSeen: now },
  },
  lastModified: now,
};

const CONTACT_DAVE: Contact = {
  id: USER_DAVE,
  alias: 'Dave',
  firstName: 'Dave',
  surname: 'Bowman',
  email: 'dave@example.com',
  phoneNumbers: [],
  emailAddresses: ['dave@example.com'],
  serviceContacts: {
    messenger: { id: USER_DAVE, alias: 'Dave', lastSeen: now },
  },
  lastModified: now,
};

const LOCAL_GROUP_ID = URN.parse('urn:contacts:group:friends-local');
const LOCAL_GROUP_DEF: ContactGroup = {
  id: LOCAL_GROUP_ID,
  name: 'Friends and Family (Local)',
  memberUrns: [MESSENGER_USERS.ALICE, MESSENGER_USERS.BOB, USER_CHARLIE],
  lastModified: now,
};

export const ACTIVE_USER_LOCAL_GROUP: MessengerScenarioData = {
  local_device: {
    identity: { seeded: true },
    notifications: { permission: 'granted', isSubscribed: true },

    // ✅ NEW STRUCTURE
    contactSetup: {
      contacts: [CONTACT_ALICE, CONTACT_BOB, CONTACT_CHARLIE, CONTACT_DAVE],
      groups: [LOCAL_GROUP_DEF],
    },
    messaging: {
      messages: [],
      outbox: [],
      quarantine: [],
    },
    directory: { groups: [], entities: [] },
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: true },
    network: { queuedMessages: [] },
    send: { shouldFail: false },
  },
};

const NETWORK_GROUP_ID = URN.parse('urn:messenger:group:project-team');
const LINKED_LOCAL_ID = URN.parse('urn:contacts:group:project-link');

export const ACTIVE_USER_NETWORK_GROUP: MessengerScenarioData = {
  local_device: {
    identity: { seeded: true },
    notifications: { permission: 'granted', isSubscribed: true },

    // ✅ NEW STRUCTURE
    contactSetup: {
      contacts: [CONTACT_ALICE, CONTACT_BOB, CONTACT_CHARLIE, CONTACT_DAVE],
      groups: [
        {
          id: LINKED_LOCAL_ID,
          directoryId: NETWORK_GROUP_ID,
          name: 'Project Team (Network)',
          memberUrns: [],
          lastModified: now,
        },
      ],
    },
    messaging: {
      messages: [],
      outbox: [],
      quarantine: [],
    },

    directory: {
      groups: [
        {
          id: NETWORK_GROUP_ID,
          members: [
            { id: MESSENGER_USERS.ME, type: EntityTypeUser },
            { id: MESSENGER_USERS.ALICE, type: EntityTypeUser },
            { id: MESSENGER_USERS.BOB, type: EntityTypeUser },
          ],
          memberState: {
            [MESSENGER_USERS.ME.toString()]: 'joined',
            [MESSENGER_USERS.ALICE.toString()]: 'joined',
            [MESSENGER_USERS.BOB.toString()]: 'joined',
            [USER_CHARLIE.toString()]: 'joined',
            [USER_DAVE.toString()]: 'invited',
          },
          lastUpdated: now,
        },
      ],
      entities: [],
    },
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: true },
    network: { queuedMessages: [] },
    send: { shouldFail: false },
  },
};
