import { URN, User } from '@nx-platform-application/platform-types';

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
