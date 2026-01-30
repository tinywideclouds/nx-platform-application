import { Temporal } from '@js-temporal/polyfill';
import { MessengerScenarioData } from '../types';
import {
  DEFAULT_USER,
  MESSENGER_USERS,
  CONTACT_ALICE,
  CONTACT_BOB,
} from '../data/users.const';
import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';

const NOW = Temporal.Now.instant();

// STATE 3: Active User (Happy Path)
export const ACTIVE_USER: MessengerScenarioData = {
  local_device: {
    identity: { seeded: true },
    notifications: { permission: 'granted', isSubscribed: true },

    // ✅ 1. Contacts (Populated & Linked)
    contactSetup: {
      contacts: [CONTACT_ALICE, CONTACT_BOB],
    },
    directory: { groups: [], entities: [] },
    // ✅ 2. Messages (History Exists)
    messaging: {
      conversations: [
        {
          name: 'Alice',
          id: MESSENGER_USERS.ALICE,
          unreadCount: 0,
          snippet: 'Hey! Are we..',
          lastModified: NOW.subtract({
            minutes: 30,
          }).toString() as ISODateTimeString,
          lastActivityTimestamp: NOW.subtract({
            minutes: 3,
          }).toString() as ISODateTimeString,
          genesisTimestamp: NOW.subtract({
            minutes: 1203,
          }).toString() as ISODateTimeString,
        },
        {
          name: 'Bob',
          id: MESSENGER_USERS.BOB,
          unreadCount: 0,
          snippet: 'I pushed...',
          lastModified: NOW.subtract({
            hours: 2,
          }).toString() as ISODateTimeString,
          lastActivityTimestamp: NOW.subtract({
            hours: 2,
          }).toString() as ISODateTimeString,
          genesisTimestamp: NOW.toZonedDateTimeISO(Temporal.Now.timeZoneId())
            .subtract({
              weeks: 6,
              hours: 2,
            })
            .toString() as ISODateTimeString,
        },
      ],
      messages: [
        // THREAD 1: ALICE (Received Message)
        {
          id: 'msg-alice-1',
          conversationUrn: MESSENGER_USERS.ALICE,
          senderUrn: MESSENGER_USERS.ALICE,
          type: MessageTypeText,
          text: 'Hey! Are we still on for the design review?',
          sentAt: NOW.subtract({ minutes: 3 }).toString() as ISODateTimeString,
          status: 'read',
        },
        // THREAD 2: BOB (Sent Message)
        {
          id: 'msg-bob-1',
          conversationUrn: MESSENGER_USERS.BOB,
          senderUrn: MESSENGER_USERS.ME, // Sent by ME
          type: MessageTypeText,
          text: 'I pushed the latest mocks. Let me know what you think.',
          sentAt: NOW.subtract({ hours: 2 }).toString() as ISODateTimeString,
          status: 'sent',
        },
      ],
      outbox: [],
      quarantine: [],
    },
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: true },
    network: { queuedMessages: [] },
    send: { shouldFail: false },
  },
};
