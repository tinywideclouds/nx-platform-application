// apps/platform/node-identity-service/src/main.ts

import express from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Firestore } from '@google-cloud/firestore';
import { FirestoreStore } from '@google-cloud/connect-firestore';
import { pinoHttp } from 'pino-http';

import { logger } from '@nx-platform-application/node-logger';
import { config } from './config.js';
import { configurePassport } from './internal/auth/passport.config.js';
import { createMainRouter } from './routes/index.js';
import { generateJwks, jwksRouter } from './routes/jwt/jwks.js';
// [CHANGED] Import the new e2e test-only routes
import { e2eRoutes } from './routes/e2e/e2e.routes.js';
import { validateJwtConfiguration } from './internal/services/jwt-validator.service.js';
import { centralErrorHandler } from './internal/middleware/error.middleware.js';

// --- 1. Import new Policy framework ---
import { IAuthorizationPolicy } from './internal/auth/policies/authorization.policy.js';
import { AllowAllPolicy } from './internal/auth/policies/allow-all.policy.js';
import { MembershipPolicy } from './internal/auth/policies/membership.policy.js';
import { BlockPolicy } from './internal/auth/policies/block.policy.js';
// ---

async function startServer() {
  try {
    logger.info(
      { service: 'node-identity-service', state: 'initializing' },
      'Initializing service...'
    );

    if (!config.gcpProjectId) {
      throw new Error('GCP_PROJECT_ID is not defined in the configuration.');
    }

    // --- DATABASE INITIALIZATION ---
    const db = new Firestore({ projectId: config.gcpProjectId });
    try {
      await db.listCollections();
      logger.info(
        {
          component: 'Firestore',
          status: 'connected',
          projectId: config.gcpProjectId,
        },
        'Firestore connection verified.'
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('invalid_grant')) {
        logger.fatal(
          { err: error },
          "Firestore authentication failed. Your local gcloud credentials may have expired. Please run 'gcloud auth application-default login' and try again."
        );
      }
      throw error;
    }

    // --- 2. SELECT AND INITIALIZE AUTH POLICY ---
    // This now reads the pre-validated policy from the config object.
    let authPolicy: IAuthorizationPolicy;

    switch (config.authPolicy) {
      case 'MEMBERSHIP':
        authPolicy = new MembershipPolicy(db);
        logger.info(
          { component: 'AuthPolicy', policy: 'MEMBERSHIP' },
          'Using MEMBERSHIP authorization policy.'
        );
        break;
      case 'BLOCK':
        authPolicy = new BlockPolicy(db);
        logger.info(
          { component: 'AuthPolicy', policy: 'BLOCK' },
          'Using BLOCK authorization policy.'
        );
        break;
      case 'ALLOW_ALL':
      default:
        authPolicy = new AllowAllPolicy();
        logger.info(
          { component: 'AuthPolicy', policy: 'ALLOW_ALL' },
          'Using ALLOW_ALL authorization policy.'
        );
    }
    // ---

    // --- CRYPTOGRAPHIC KEY INITIALIZATION ---
    // [CHANGED] Pass the logger instance to the validation service
    await validateJwtConfiguration(logger);
    await generateJwks();
    logger.info(
      { component: 'JWKS', status: 'generated' },
      'JWKS cryptographic keys generated and cached.'
    );

    const app = express();

    // Required for Express to respect X-Forwarded-* headers from NGINX
    app.set('trust proxy', true);
    logger.info('set trust proxy to: true');

    // --- CORE MIDDLEWARE ---
    app.use(pinoHttp({ logger }));
    app.use(helmet());
    app.use(
      cors({
        origin: config.allowedOrigins,
        credentials: true,
      })
    );

    const firestoreSessionStore = new FirestoreStore({
      dataset: db,
      kind: 'express-sessions',
    });

    app.use(
      session({
        store: firestoreSessionStore,
        secret: config.sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        },
      })
    );

    // --- PASSPORT MIDDLEWARE & CONFIGURATION ---
    app.use(passport.initialize());
    app.use(passport.session());
    // --- 3. Pass the chosen policy to passport config ---
    configurePassport(db, authPolicy);

    // --- RATE LIMITING ---
    if (config.enableRateLimiter) {
      const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
      });
      app.use('/auth', authLimiter);
      logger.info(
        { component: 'RateLimiter', status: 'enabled' },
        'In-app rate limiting is active for /auth routes'
      );
    }

    app.use(jwksRouter);

    // --- ROUTE CONFIGURATION ---
    const mainRouter = createMainRouter(db);
    app.use('/api', mainRouter);

    // [CHANGED] --- E2E TEST ROUTE (NON-PRODUCTION ONLY) ---
    // This block ensures these dangerous test routes are not
    // even loaded into memory in a production environment.
    if (process.env.NODE_ENV !== 'production') {
      logger.warn(
        {
          component: 'E2E',
          status: 'active',
          path: '/api/e2e/generate-test-token',
        },
        'Loading e2e-only test routes. This must NOT be seen in production.'
      );
      // Mount the e2e test router
      app.use('/api', e2eRoutes);
    }

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
        `Server started successfully on port ${config.port}`
      );
    });
  } catch (error: unknown) {
    logger.fatal({ err: error }, 'FATAL: SERVER FAILED TO START');
    process.exit(1);
  }
}

startServer();
