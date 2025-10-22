import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { Firestore } from '@google-cloud/firestore'; // ADDED
import { startTestServer } from './test-setup.js';
import type { User } from '@nx-platform-application/platform-types'; // ADDED

// ADDED: Define a user to seed the database with
const testUser: User = {
  id: 'user-for-lookup',
  email: 'test@example.com',
  alias: 'TestLookup',
};

// ADDED: Define the API key for the test
const INTERNAL_API_KEY = 'a-super-secret-key-for-testing';

let testServer: {
  app: Express;
  stopServer: () => Promise<void>;
} | undefined;
let db: Firestore; // ADDED

describe('API Endpoints (Integration)', () => {
  beforeAll(async () => {
    // ADDED: Set the environment variable before the server starts so the config loads it
    process.env.INTERNAL_API_KEY = INTERNAL_API_KEY;

    testServer = await startTestServer();
    if (testServer == undefined) throw new Error("testServer undefined");

    // ADDED: Get a reference to the test database
    db = new Firestore({ projectId: 'test-project' });
  }, 60000);

  afterAll(async () => {
    if (testServer) await testServer.stopServer();
    delete process.env.INTERNAL_API_KEY; // Clean up the environment variable
  }, 60000);

  // ADDED: Seed the database before each test in this suite
  beforeEach(async () => {
    await db.collection('authorized_users').doc(testUser.id).set(testUser);
  });

  it('GET /api/auth/status should return not authenticated for unauthenticated requests', async () => {
    if (!testServer) throw new Error("testServer undefined");
    const response = await request(testServer.app).get('/api/auth/status');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ authenticated: false, user: null });
  });

  it('GET /api/users/by-email/:email should fail without an internal API key', async () => {
    if (!testServer) throw new Error("testServer undefined");
    const response = await request(testServer.app).get('/api/users/by-email/test@example.com');
    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Invalid internal API key');
  });

  // ADDED: New test for the successful "happy path"
  it('GET /api/users/by-email/:email should return a user profile with a valid API key', async () => {
    if (!testServer) throw new Error("testServer undefined");

    const response = await request(testServer.app)
      .get(`/api/users/by-email/${testUser.email}`)
      .set('x-internal-api-key', INTERNAL_API_KEY); // Set the required header

    expect(response.status).toBe(200);
    // We get back a subset of the User properties, without the ID
    expect(response.body).toEqual({
      alias: testUser.alias,
      email: testUser.email,
    });
  });
});
