import { URN, User } from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-types'; // ✅ Import Contact Type
import {
  MessageDeliveryStatus,
  DeliveryStatus,
} from '@nx-platform-application/messenger-types';

// --- 1. DATA MODEL INTERFACES ---

export interface MockMessageDef {
  id: string;
  senderUrn: URN;
  text: string;
  sentAt: string;
  status: MessageDeliveryStatus;
}

export interface MockOutboxDef {
  id: string;
  messageId: string;
  recipientUrns: URN[];
  text: string;
  status: DeliveryStatus;
}

export interface MockPushNotificationConfig {
  permission: NotificationPermission;
  isSubscribed: boolean;
}

// --- 2. SERVICE CONFIGURATION INTERFACES ---

export interface MockServerAuthState {
  authenticated: boolean;
  user?: User;
}

export interface MockServerIdentityState {
  hasMyKey: boolean;
  keyMismatch?: boolean;
}

export interface MockServerNetworkState {
  queuedMessages: MockMessageDef[];
}

export interface MockChatSendConfig {
  shouldFail?: boolean;
  errorMsg?: string;
  latencyMs?: number;
}

/**
 * THE MASTER SCENARIO DEFINITION
 */
export interface MessengerScenarioData {
  local_device: {
    messages: MockMessageDef[];
    outbox: MockOutboxDef[];
    quarantine: MockMessageDef[];
    contacts?: Contact[]; // ✅ NEW: Explicit Contact Seeding
    identity?: { seeded: boolean };
    notifications: MockPushNotificationConfig;
  };
  remote_server: {
    auth: MockServerAuthState;
    identity: MockServerIdentityState;
    network: MockServerNetworkState;
    send: MockChatSendConfig;
  };
}

// --- 3. CONSTANTS ---

export const SCENARIO_USERS = {
  ME: URN.parse('urn:contacts:user:me'),
  ALICE: URN.parse('urn:contacts:user:alice'),
  BOB: URN.parse('urn:contacts:user:bob'),
  SPAMMER: URN.parse('urn:contacts:user:spammer'),
};

const DEFAULT_USER: User = {
  id: SCENARIO_USERS.ME,
  alias: 'Me',
  email: 'me@example.com',
};

// --- CONTACT DEFINITIONS ---

const CONTACT_ALICE: Contact = {
  id: SCENARIO_USERS.ALICE,
  alias: 'Alice',
  firstName: 'Alice',
  surname: 'Wonderland',
  email: 'alice@example.com',
  phoneNumbers: [],
  emailAddresses: ['alice@example.com'],
  // ✅ FIX: Match ServiceContact interface (id + alias + lastSeen)
  serviceContacts: {
    messenger: {
      id: SCENARIO_USERS.ALICE, // Inherited from Resource
      alias: 'Alice',
      lastSeen: new Date().toISOString() as any,
    },
  },
  lastModified: new Date().toISOString() as any,
};

const CONTACT_BOB: Contact = {
  id: SCENARIO_USERS.BOB,
  alias: 'Bob',
  firstName: 'Bob',
  surname: 'Builder',
  email: 'bob@example.com',
  phoneNumbers: [],
  emailAddresses: ['bob@example.com'],
  // ✅ FIX: Match ServiceContact interface
  serviceContacts: {
    messenger: {
      id: SCENARIO_USERS.BOB,
      alias: 'Bob',
      lastSeen: new Date().toISOString() as any,
    },
  },
  lastModified: new Date().toISOString() as any,
};

// --- 4. SCENARIOS ---

const ORPHANED_IDENTITY: MessengerScenarioData = {
  local_device: {
    identity: { seeded: true },
    messages: [],
    outbox: [],
    quarantine: [],
    contacts: [],
    notifications: { permission: 'granted', isSubscribed: true },
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: false },
    network: { queuedMessages: [] },
    send: { shouldFail: false },
  },
};

const ACTIVE_CHAT: MessengerScenarioData = {
  local_device: {
    identity: { seeded: true },
    outbox: [],
    quarantine: [],
    contacts: [], // Populate this if you want pre-seeded contacts
    notifications: { permission: 'granted', isSubscribed: true },
    messages: [
      {
        id: 'msg-101',
        senderUrn: SCENARIO_USERS.ALICE,
        text: 'Hey! Did you see the new mock engine?',
        sentAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        status: 'read',
      },
      {
        id: 'msg-102',
        senderUrn: SCENARIO_USERS.BOB,
        text: 'Meeting in 5 mins',
        sentAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        status: 'received',
      },
    ],
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: true },
    network: { queuedMessages: [] },
    send: { shouldFail: false },
  },
};

const IDENTITY_CONFLICT: MessengerScenarioData = {
  local_device: {
    identity: { seeded: false },
    messages: [],
    outbox: [],
    quarantine: [],
    contacts: [],
    notifications: { permission: 'default', isSubscribed: false },
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: true, keyMismatch: true },
    network: { queuedMessages: [] },
    send: { shouldFail: false },
  },
};

const FLIGHT_MODE_RECOVERY: MessengerScenarioData = {
  local_device: {
    identity: { seeded: true },
    messages: [],
    outbox: [],
    quarantine: [],
    contacts: [],
    notifications: { permission: 'granted', isSubscribed: true },
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: true },
    network: {
      queuedMessages: [
        {
          id: 'msg-offline-1',
          senderUrn: SCENARIO_USERS.ALICE,
          text: 'Are you there? This message was queued.',
          sentAt: new Date().toISOString(),
          status: 'sent',
        },
      ],
    },
    send: { shouldFail: false },
  },
};

const STRANGER_DANGER: MessengerScenarioData = {
  local_device: {
    identity: { seeded: true },
    messages: [],
    outbox: [],
    quarantine: [
      {
        id: 'spam-1',
        senderUrn: SCENARIO_USERS.SPAMMER,
        text: 'You have won a free iPhone! Click here.',
        sentAt: new Date().toISOString(),
        status: 'received',
      },
    ],
    contacts: [],
    notifications: { permission: 'granted', isSubscribed: true },
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: true },
    network: { queuedMessages: [] },
    send: { shouldFail: false },
  },
};

// STATE 1: Completely New User
const NEW_USER: MessengerScenarioData = {
  local_device: {
    messages: [],
    outbox: [],
    quarantine: [],
    contacts: [], // Empty
    identity: { seeded: false }, // No Keys
    notifications: { permission: 'default', isSubscribed: false },
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: false }, // Remote 404
    network: { queuedMessages: [] },
    send: { shouldFail: false },
  },
};

// STATE 2: User with Keys, No Contacts
const FRESH_LOGIN: MessengerScenarioData = {
  local_device: {
    messages: [],
    outbox: [],
    quarantine: [],
    contacts: [], // Empty
    identity: { seeded: true }, // Has Keys
    notifications: { permission: 'granted', isSubscribed: true },
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: true }, // Remote OK
    network: { queuedMessages: [] },
    send: { shouldFail: false },
  },
};

// STATE 3: User with Keys, Bob and Alice (DEFAULT)
const ACTIVE_USER: MessengerScenarioData = {
  local_device: {
    messages: [
      {
        id: 'msg-101',
        senderUrn: SCENARIO_USERS.ALICE,
        text: 'Welcome to the mock world!',
        sentAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        status: 'read',
      },
    ],
    outbox: [],
    quarantine: [],
    contacts: [CONTACT_ALICE, CONTACT_BOB], // ✅ Populated
    identity: { seeded: true },
    notifications: { permission: 'granted', isSubscribed: true },
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: true },
    network: { queuedMessages: [] },
    send: { shouldFail: false },
  },
};

export const MESSENGER_SCENARIOS = {
  'new-user': NEW_USER, // ?scenario=new-user
  'fresh-login': FRESH_LOGIN, // ?scenario=fresh-login
  'active-user': ACTIVE_USER, // ?scenario=active-user (Default)
  'orphaned-identity': ORPHANED_IDENTITY,
  'active-chat': ACTIVE_CHAT,
  'identity-conflict': IDENTITY_CONFLICT,
  'flight-mode': FLIGHT_MODE_RECOVERY,
  'stranger-danger': STRANGER_DANGER,
};
