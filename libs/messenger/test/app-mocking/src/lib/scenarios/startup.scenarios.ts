import { MessengerScenarioData } from '../types';
import { DEFAULT_USER } from '../data/users.const';

// STATE 1: Completely New User (No Keys, No Data)
export const NEW_USER: MessengerScenarioData = {
  local_device: {
    messages: [],
    outbox: [],
    quarantine: [],
    contacts: [],
    identity: { seeded: false },
    notifications: { permission: 'default', isSubscribed: false },
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: false }, // Remote 404
    network: { queuedMessages: [] },
    send: { shouldFail: false },
    directory: { groups: [], entities: [] },
  },
};

// STATE 2: Fresh Login (Keys Exist, Data Empty)
export const FRESH_LOGIN: MessengerScenarioData = {
  local_device: {
    messages: [],
    outbox: [],
    quarantine: [],
    contacts: [], // Address book empty until sync
    identity: { seeded: true },
    notifications: { permission: 'granted', isSubscribed: true },
  },
  remote_server: {
    auth: { authenticated: true, user: DEFAULT_USER },
    identity: { hasMyKey: true },
    network: { queuedMessages: [] },
    send: { shouldFail: false },
    directory: { groups: [], entities: [] },
  },
};
