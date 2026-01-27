import {
  DirectoryEntity,
  DirectoryGroup,
} from '@nx-platform-application/directory-types';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Temporal } from '@js-temporal/polyfill';

const now = Temporal.Now.instant().toString() as ISODateTimeString;

// --- 1. ID Definitions ---

// Alice: Pure Contact
export const idAliceContact = URN.parse('urn:contacts:user:alice');

// Bob: Hybrid (Has both a Contact ID and a Messenger ID)
export const idBobContact = URN.parse('urn:contacts:user:bob');
export const idBobMessenger = URN.parse('urn:messenger:user:bob');

export const idGroupWork = URN.parse('urn:directory:group:work-shared');

// --- 2. Entities ---

export const entityAlice: DirectoryEntity = {
  id: idAliceContact,
  type: URN.parse('urn:directory:type:user'),
  lastSeenAt: now,
};

export const entityBobContact: DirectoryEntity = {
  id: idBobContact,
  type: URN.parse('urn:directory:type:user'),
  lastSeenAt: now,
};

export const entityBobMessenger: DirectoryEntity = {
  id: idBobMessenger,
  type: URN.parse('urn:directory:type:user'),
  lastSeenAt: now,
};

// --- 3. Groups ---
// Created by Contacts App -> Contains ONLY Contact URNs
export const groupWork: DirectoryGroup = {
  id: idGroupWork,
  members: [
    entityAlice, // urn:contacts:user:alice
    entityBobContact, // urn:contacts:user:bob
  ],
  memberState: {
    [idAliceContact.toString()]: 'joined',
    [idBobContact.toString()]: 'joined',
  },
  lastUpdated: now,
};

export const directoryScenarios = {
  populated: {
    entities: [entityAlice, entityBobContact, entityBobMessenger],
    groups: [groupWork],
  },
  empty: {
    entities: [],
    groups: [],
  },
};
