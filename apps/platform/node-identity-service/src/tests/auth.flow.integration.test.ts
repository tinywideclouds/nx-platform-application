import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { addAuthorizedUser } from '../internal/firestore.js';
import { startTestServer } from './test-setup.js';
import { URN } from '@nx-platform-application/platform-types';
import type { User } from '@nx-platform-application/platform-types';

// This is the user we will add to our test database.
const authorizedUser: User = {
  id: URN.parse("urn:user:auth:1"),
  email: 'test.user@example.com',
  alias: 'TestUser',
};

// --- PASSPORT STRATEGY MOCK ---
// We mock the entire 'passport-google-oauth20' library.
// This is critical to prevent our tests from making real network calls to Google.
vi.mock('passport-google-oauth20', () => {
  // We need a class that Passport can instantiate with `new`
  class FakeStrategy {
    name = 'google';
    _verify: (
      req: any,
      accessToken: string,
      refreshToken: string,
      params: any,
      profile: any,
      done: (error: any, user?: any) => void
    ) => void;

    constructor(options: any, verify: any) {
      this._verify = verify;
    }

    // This is the function that the real Passport middleware will call.
    authenticate(req: any) {
      const userProfile = { 
        id: 'mock-google-id-123',
        displayName: authorizedUser.alias,
        emails: [{ value: authorizedUser.email }] 
      };
      const params = { id_token: 'mock-google-id-token' };

      // The 'done' callback is what our google.strategy.ts expects.
      // When it's called, we'll get the verified user.
      const done = (error: any, user: any) => {
        if (error) {
          return (this as any).fail(error);
        }
        // This is the key: we call `this.success` to signal to the real
        // Passport middleware that the user is valid. Passport then handles
        // the session and the redirect.
        (this as any).success(user);
      };

      this._verify(
        req,
        'mock-access-token',
        'mock-refresh-token',
        params,
        userProfile,
        done
      );
    }
  }

  return { Strategy: FakeStrategy };
});

describe('Authentication Flow (Integration)', () => {
  let testServer:
    | {
        app: Express;
        stopServer: () => Promise<void>;
      }
    | undefined;
  let db: Firestore;

  beforeAll(async () => {
    // Start the server which sets the FIRESTORE_EMULATOR_HOST env variable
    testServer = await startTestServer();
    console.log(
      '[TEST LOG] Test server and emulator started for Authentication Flow.'
    );
    db = new Firestore({ projectId: 'test-project' });
  }, 60000);

  afterAll(async () => {
    if (!testServer) throw new Error('test server is undefined');
    await testServer.stopServer();
  }, 60000);

  // Before each test, we clean the database and seed it with our authorized user.
  // This ensures each test runs in a predictable and isolated state.
  beforeEach(async () => {
    // This operation will now correctly connect to the running emulator.
    await addAuthorizedUser(db, authorizedUser);
  });

  it('should authenticate an authorized user and issue a JWT', async () => {
    if (!testServer) throw new Error('test server is undefined');
    // The agent will persist cookies across requests, simulating a browser session.
    const agent = request.agent(testServer.app);

    // Step 1: Simulate the Google OAuth callback.
    // Our mock strategy will intercept this, find the seeded user, and create a session.
    const loginResponse = await agent.get('/api/auth/google/callback');
    expect(loginResponse.status).toBe(302); // Expect a redirect to the frontend

    // Step 2: Use the session cookie from the previous request to get the user status.
    const statusResponse = await agent.get('/api/auth/status');

    // Assert that the user is now authenticated and has received a token.
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.authenticated).toBe(true);
    expect(statusResponse.body.user.email).toBe(authorizedUser.email);
    expect(statusResponse.body.user.alias).toBe(authorizedUser.alias);
    expect(statusResponse.body.token).toBeDefined();
    expect(statusResponse.body.token.length).toBeGreaterThan(20);
  }, 30000);
});
