// src/tests/test-setup.ts

import express from 'express';
import session from 'express-session';
import passport from 'passport';
import http from 'http';
import cors from 'cors';
import { Firestore } from '@google-cloud/firestore';
import { GenericContainer } from 'testcontainers';
import { FirestoreStore } from '@google-cloud/connect-firestore';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { vi } from 'vitest';

// --- 1. Import the policies ---
import {
  IAuthorizationPolicy,
} from '../internal/auth/policies/authorization.policy.js';
import { AllowAllPolicy } from '../internal/auth/policies/allow-all.policy.js';
// (No need to import the other policies unless your tests need to swap them)

/**
 * Creates and starts a server instance for integration testing.
 * ... (rest of docs)
 */
export async function startTestServer() {
  // --- 3. GENERATE test config and keys (unchanged) ---
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const testConfig = {
    INTERNAL_API_KEY: randomBytes(16).toString('hex'),
    JWT_PRIVATE_KEY: privateKey,
    SESSION_SECRET: 'a-fixed-secret-for-testing',
    E2E_TEST_SECRET: 'a-fixed-e2e-secret-for-testing',
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

  // --- 4. SET environment variables (unchanged) ---
  process.env.INTERNAL_API_KEY = testConfig.INTERNAL_API_KEY;
  process.env.JWT_PRIVATE_KEY = testConfig.JWT_PRIVATE_KEY;
  // ... (all other env vars) ...
  process.env.CLIENT_URL = testConfig.CLIENT_URL;

  // --- 5. THE FIX: Reset the module cache (unchanged) ---
  vi.resetModules();

  // --- 6. IMPORT server modules *after* cache reset (unchanged) ---
  const { configurePassport } = await import(
    '../internal/auth/passport.config'
  );
  const { createMainRouter } = await import('../routes');

  // --- 7. Continue with server/emulator setup (unchanged) ---
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

  // --- 8. THE FIX: Instantiate and pass the auth policy ---
  const testAuthPolicy = new AllowAllPolicy();
  configurePassport(db, testAuthPolicy);

  const mainRouter = createMainRouter(db);
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

      const keys = Object.keys(testConfig) as Array<keyof typeof testConfig>;
      for (const key of keys) {
        delete process.env[key];
      }
    },
    testConfig,
  };
}