import request from 'supertest';
import type { Express } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { startTestServer } from './test-setup.js';
import type { User } from '@nx-platform-application/platform-types';

// Define a user to seed the database with
const testUser: User = {
  id: 'user-for-lookup',
  email: 'test@example.com',
  alias: 'TestLookup',
};

// Define variables at the top level
let testConfig: Awaited<ReturnType<typeof startTestServer>>['testConfig'];
let testServer:
  | {
  app: Express;
  stopServer: () => Promise<void>;
}
  | undefined;
let db: Firestore;

describe('API Endpoints (Integration)', () => {
  beforeAll(async () => {
    // Get the app, stop function, AND the config
    const serverSetup = await startTestServer();
    testServer = { app: serverSetup.app, stopServer: serverSetup.stopServer };
    testConfig = serverSetup.testConfig; // <-- Store the generated config

    if (testServer == undefined) throw new Error('testServer undefined');

    db = new Firestore({ projectId: 'test-project' });
  }, 60000);

  afterAll(async () => {
    if (testServer) await testServer.stopServer();
  }, 60000);

  beforeEach(async () => {
    // Seed the database
    await db.collection('authorized_users').doc(testUser.id).set(testUser);
  });

  it('GET /api/auth/status should return not authenticated for unauthenticated requests', async () => {
    if (!testServer) throw new Error('testServer undefined');
    const response = await request(testServer.app).get('/api/auth/status');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ authenticated: false, user: null });
  });

  it('GET /api/users/by-email/:email should fail without an internal API key', async () => {
    if (!testServer) throw new Error('testServer undefined');
    const response = await request(testServer.app).get(
      '/api/users/by-email/test@example.com'
    );
    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Invalid internal API key');
  });

  it('GET /api/users/by-email/:email should return a user profile with a valid API key', async () => {
    if (!testServer) throw new Error('testServer undefined');

    const response = await request(testServer.app)
      .get(`/api/users/by-email/${testUser.email}`)
      // Use the generated internal API key from the testConfig
      .set('x-internal-api-key', testConfig.INTERNAL_API_KEY);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: testUser.id,
      alias: testUser.alias,
      email: testUser.email,
    });
  });
});
