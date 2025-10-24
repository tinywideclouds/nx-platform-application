import express from 'express';
import session from 'express-session';
import passport from 'passport';
import http from 'http';
import cors from 'cors';
import { Firestore } from '@google-cloud/firestore';
import { GenericContainer } from 'testcontainers';
import { FirestoreStore } from '@google-cloud/connect-firestore';
import { configurePassport } from '../internal/auth/passport.config';
import { createMainRouter } from '../routes';

/**
 * Creates and starts a server instance for integration testing.
 * It replicates the setup from `main.ts` but uses the Firestore emulator
 * and listens on an ephemeral port.
 *
 * @returns An object containing the Express app instance and a function to stop the server.
 */
export async function startTestServer() {
  // Define the Firestore emulator container
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

  // Start the container before the server
  const firestoreContainer = await container.start();

  // Set the environment variable for the Firestore client
  process.env.FIRESTORE_EMULATOR_HOST = `${firestoreContainer.getHost()}:${firestoreContainer.getMappedPort(
    8080
  )}`;

  const db = new Firestore({ projectId: 'test-project' });
  const app = express();

  // --- REPLICATE MIDDLEWARE SETUP FROM main.ts ---
  app.use(cors({ origin: 'http://localhost:4200', credentials: true }));

  const firestoreSessionStore = new FirestoreStore({
    dataset: db,
    // Use a dedicated collection for test sessions to keep them separate.
    kind: 'express-sessions-test',
  });

  app.use(
    session({
      store: firestoreSessionStore,
      // Use a static, known secret for predictable behavior in tests.
      secret: 'a-fixed-secret-for-testing',
      resave: false,
      saveUninitialized: false,
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());
  configurePassport(db);

  // This is correct and matches main.ts
  const mainRouter = createMainRouter(db);
  app.use('/api', mainRouter);

  // --- CREATE AND START THE HTTP SERVER ---
  const server = http.createServer(app);

  // Listen on port 0, which tells the OS to assign a random, available port.
  // This is crucial for preventing port conflicts when running tests in parallel.
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
      // Stop the Docker container after the server is closed
      await firestoreContainer.stop();
      delete process.env.FIRESTORE_EMULATOR_HOST;
    },
  };
}
