import { MessengerScenarioData } from '../types';
import {
  DEFAULT_USER,
  MESSENGER_USERS,
  CONTACT_ALICE,
  CONTACT_BOB,
} from '../data/users.const';

// STATE 3: Active User (Happy Path)
export const ACTIVE_USER: MessengerScenarioData = {
  local_device: {
    identity: { seeded: true },
    notifications: { permission: 'granted', isSubscribed: true },

    // ✅ 1. Contacts (Populated & Linked)
    contacts: [CONTACT_ALICE, CONTACT_BOB],

    // ✅ 2. Messages (History Exists)
    messages: [
      // THREAD 1: ALICE (Received Message)
      {
        id: 'msg-alice-1',
        senderUrn: MESSENGER_USERS.ALICE,
        text: 'Hey! Are we still on for the design review?',
        sentAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
        status: 'read',
      },
      // THREAD 2: BOB (Sent Message)
      {
        id: 'msg-bob-1',
        senderUrn: MESSENGER_USERS.ME, // Sent by ME
        text: 'I pushed the latest mocks. Let me know what you think.',
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        status: 'sent',
      },
    ],

    // ⚠️ TODO: We likely need to seed 'conversations' table here
    // once we confirm the domain logic.

    outbox: [],
    quarantine: [],
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: true },
    network: { queuedMessages: [] },
    send: { shouldFail: false },
  },
};
