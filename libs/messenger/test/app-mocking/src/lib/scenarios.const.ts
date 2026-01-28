import { URN, User } from '@nx-platform-application/platform-types';

// Import Scenarios from their specific files
import { NEW_USER, FRESH_LOGIN } from './scenarios/startup.scenarios';
import { ACTIVE_USER } from './scenarios/messaging.scenarios';
import { FLIGHT_MODE_RECOVERY } from './scenarios/offline.scenarios';
import { ACTIVE_USER_INTERACTIVE } from './scenarios/interactive.scenarios';
import {
  ACTIVE_USER_LOCAL_GROUP,
  ACTIVE_USER_NETWORK_GROUP,
} from './scenarios/groups.scenarios';

// Shared Constants
export const SCENARIO_USERS = {
  ME: URN.parse('urn:contacts:user:me'),
  ALICE: URN.parse('urn:contacts:user:alice'),
  BOB: URN.parse('urn:contacts:user:bob'),
  SPAMMER: URN.parse('urn:contacts:user:spammer'),
};

export const DEFAULT_USER: User = {
  id: SCENARIO_USERS.ME,
  alias: 'Me',
  email: 'me@example.com',
};

// The Registry
export const MESSENGER_SCENARIOS = {
  'new-user': NEW_USER,
  'fresh-login': FRESH_LOGIN,
  'active-user': ACTIVE_USER,
  'flight-mode': FLIGHT_MODE_RECOVERY,
  'active-user-interactive': ACTIVE_USER_INTERACTIVE,
  'group-local': ACTIVE_USER_LOCAL_GROUP,
  'group-network': ACTIVE_USER_NETWORK_GROUP,
};
