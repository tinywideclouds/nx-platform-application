import { URN, User } from '@nx-platform-application/platform-types';

/**
 * Defines the app-specific mock users for the messenger application.
 * This list is provided to the MOCK_USERS_TOKEN in app.config.ts.
 */
export const MESSENGER_MOCK_USERS: User[] = [
  {
    id: URN.parse('urn:contacts:user:mock-alice'),
    alias: 'Alice (Mock)',
    email: 'alice@mock.com',
  },
  {
    id: URN.parse('urn:contacts:user:mock-bob'),
    alias: 'Bob (Mock)',
    email: 'bob@mock.com',
  },
];
