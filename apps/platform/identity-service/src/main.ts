import express from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import helmet from 'helmet'; // ADDED: For security headers
import rateLimit from 'express-rate-limit'; // ADDED: For rate limiting
import { Firestore } from '@google-cloud/firestore';
import { FirestoreStore } from '@google-cloud/connect-firestore';
import { pinoHttp } from 'pino-http';

import { logger } from './internal/services/logger.service.js';
import { config } from './config.js';
import { configurePassport } from './internal/auth/passport.config.js';
import { createMainRouter } from './routes/index.js';
import { generateJwks } from './routes/jwt/jwks.js';
import { validateJwtConfiguration } from './internal/services/jwt-validator.service.js';
import { centralErrorHandler } from './internal/middleware/error.middleware.js';

async function startServer() {
  try {
    logger.info({ service: 'node-identity-service', state: 'initializing' }, 'Initializing service...');

    if (!config.gcpProjectId) {
      throw new Error('GCP_PROJECT_ID is not defined in the configuration.');
    }

    // --- DATABASE INITIALIZATION ---
    const db = new Firestore({ projectId: config.gcpProjectId });
    try {
      // This is the first command that actually tries to contact Firestore.
      await db.listCollections();
      logger.info({ component: 'Firestore', status: 'connected', projectId: config.gcpProjectId }, 'Firestore connection verified.');
    } catch (error: unknown) {
      // Check for the specific gcloud authentication error.
      if (error instanceof Error && error.message.includes('invalid_grant')) {
        logger.fatal(
          { err: error },
          "Firestore authentication failed. Your local gcloud credentials may have expired. Please run 'gcloud auth application-default login' and try again."
        );
      }
      // Re-throw the error to be caught by the outer block, which will stop the server.
      throw error;
    }

    // --- CRYPTOGRAPHIC KEY INITIALIZATION ---
    await validateJwtConfiguration();
    await generateJwks();
    // CHANGED: Replaced console.log with structured logging
    logger.info({ component: 'JWKS', status: 'generated' }, 'JWKS cryptographic keys generated and cached.');

    const app = express();

    // --- CORE MIDDLEWARE ---
    // ADDED: pino-http for automatic, structured request logging
    app.use(pinoHttp({ logger }));

    // ADDED: helmet for essential security headers
    app.use(helmet());

    // CHANGED: Using config.clientUrl instead of a hardcoded value
    app.use(cors({
      origin: config.clientUrl,
      credentials: true,
    }));

    const firestoreSessionStore = new FirestoreStore({
      dataset: db,
      kind: 'express-sessions',
    });

    app.use(session({
      store: firestoreSessionStore,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      // Secure cookies in production
      cookie: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' },
    }));

    // --- PASSPORT MIDDLEWARE & CONFIGURATION ---
    app.use(passport.initialize());
    app.use(passport.session());
    configurePassport(db);

    // ADDED: Feature-flagged rate limiting
    if (config.enableRateLimiter) {
      const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
      });
      app.use('/auth', authLimiter);
      // CHANGED: Replaced simple string with a structured log
      logger.info({ component: 'RateLimiter', status: 'enabled' }, 'In-app rate limiting is active for /auth routes');
    }

    // --- ROUTE CONFIGURATION ---
    const mainRouter = createMainRouter(db);
    app.use('/api', mainRouter);

    // --- CENTRAL ERROR HANDLING ---
    // This MUST be the last middleware added.
    app.use(centralErrorHandler(logger));

    // --- SERVER START ---
    app.listen(config.port, () => {
      logger.info(
        {
          service: 'node-identity-service',
          port: config.port,
          state: 'listening',
        },
        'Server started successfully'
      );
    });

  } catch (error: unknown) {
    logger.fatal({ err: error }, 'FATAL: SERVER FAILED TO START');
    process.exit(1);
  }
}

startServer();
