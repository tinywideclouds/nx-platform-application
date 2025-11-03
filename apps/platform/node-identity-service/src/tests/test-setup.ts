// src/tests/test-setup.ts

import express from 'express';
import session from 'express-session';
import passport from 'passport';
import http from 'http';
import cors from 'cors';
import { Firestore } from '@google-cloud/firestore';
import { GenericContainer } from 'testcontainers';
import { FirestoreStore } from '@google-cloud/connect-firestore';
// --- 1. IMPORT crypto and vitest ---
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { vi } from 'vitest';

// --- 2. REMOVE server-side imports from the top level ---
// These must be imported *inside* the function after the cache is reset.
// import { configurePassport } from '../internal/auth/passport.config';
// import { createMainRouter } from '../routes';

/**
 * Creates and starts a server instance for integration testing.
 * It replicates the setup from `main.ts` but uses the Firestore emulator
 * and listens on an ephemeral port.
 *
 * @returns An object containing the Express app instance, a function to stop the server,
 * and the test configuration used.
 */
export async function startTestServer() {
  // --- 3. GENERATE test config and keys ---
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const testConfig = {
    INTERNAL_API_KEY: randomBytes(16).toString('hex'),
    JWT_PRIVATE_KEY: privateKey,
    SESSION_SECRET: 'a-fixed-secret-for-testing',
    E2E_TEST_SECRET: 'a-fixed-e2e-secret-for-testing',
    // Add other required env vars for the config validation
    GCP_PROJECT_ID: 'test-project',
    GOOGLE_CLIENT_ID: 'test-google-id',
    GOOGLE_CLIENT_SECRET: 'test-google-secret',
    GOOGLE_REDIRECT_URL_SUCCESS: 'http://test-success',
    GOOGLE_REDIRECT_URL_FAILURE: 'http://test-failure',
    GOOGLE_AUTH_CALLBACK: '/test-callback',
    JWT_SECRET: 'a-real-jwt-secret',
    JWT_AUDIENCE: 'test-audience',
    CLIENT_URL: 'http://test-client',
  };

  // --- 4. SET environment variables *before* any server imports ---
  process.env.INTERNAL_API_KEY = testConfig.INTERNAL_API_KEY;
  process.env.JWT_PRIVATE_KEY = testConfig.JWT_PRIVATE_KEY;
  process.env.SESSION_SECRET = testConfig.SESSION_SECRET;
  process.env.E2E_TEST_SECRET = testConfig.E2E_TEST_SECRET;
  process.env.GCP_PROJECT_ID = testConfig.GCP_PROJECT_ID;
  process.env.GOOGLE_CLIENT_ID = testConfig.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = testConfig.GOOGLE_CLIENT_SECRET;
  process.env.GOOGLE_REDIRECT_URL_SUCCESS =
    testConfig.GOOGLE_REDIRECT_URL_SUCCESS;
  process.env.GOOGLE_REDIRECT_URL_FAILURE =
    testConfig.GOOGLE_REDIRECT_URL_FAILURE;
  process.env.GOOGLE_AUTH_CALLBACK = testConfig.GOOGLE_AUTH_CALLBACK;
  process.env.JWT_SECRET = testConfig.JWT_SECRET;
  process.env.JWT_AUDIENCE = testConfig.JWT_AUDIENCE;
  process.env.CLIENT_URL = testConfig.CLIENT_URL;

  // --- 5. THE FIX: Reset the module cache ---
  // This clears the cached config.ts (and all other server modules).
  vi.resetModules();

  // --- 6. IMPORT server modules *after* cache reset ---
  // Now, when these are imported, they will re-load config.ts,
  // which will read the new process.env values.
  const { configurePassport } = await import(
    '../internal/auth/passport.config'
    );
  const { createMainRouter } = await import('../routes');

  // --- 7. Continue with server/emulator setup ---
  const container = new GenericContainer(
    'gcr.io/google.com/cloudsdktool/cloud-sdk:emulators'
  )
    .withExposedPorts(8080)
    .withCommand([
      'gcloud',
      'beta',
      'emulators',
      'firestore',
      'start',
      '--host-port',
      '0.0.0.0:8080',
    ]);

  const firestoreContainer = await container.start();
  process.env.FIRESTORE_EMULATOR_HOST = `${firestoreContainer.getHost()}:${firestoreContainer.getMappedPort(
    8080
  )}`;

  const db = new Firestore({ projectId: 'test-project' });
  const app = express();

  app.use(cors({ origin: 'http://localhost:4200', credentials: true }));

  const firestoreSessionStore = new FirestoreStore({
    dataset: db,
    kind: 'express-sessions-test',
  });

  app.use(
    session({
      store: firestoreSessionStore,
      secret: testConfig.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());
  configurePassport(db); // This now uses the correctly loaded config

  const mainRouter = createMainRouter(db); // This also uses the correct config
  app.use('/api', mainRouter);

  const server = http.createServer(app);
  server.listen(0);

  return {
    app,
    stopServer: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      await firestoreContainer.stop();
      delete process.env.FIRESTORE_EMULATOR_HOST;

      // Clean up all test env variables
      const keys = Object.keys(testConfig) as Array<keyof typeof testConfig>;
      for (const key of keys) {
        delete process.env[key];
      }
    },
    // --- 8. Return the config for tests to use ---
    testConfig,
  };
}
