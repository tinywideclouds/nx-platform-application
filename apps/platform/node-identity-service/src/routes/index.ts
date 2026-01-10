// apps/platform/node-identity-service/src/routes/index.ts

import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { googleAuthRoutes } from './auth/google.js';
import { createUserApiRoutes } from './api/users.js';
import { healthCheckRouter } from './heath-check.js';
// 1. Import the new router factory
import { createIntegrationsRouter } from './integrations/integrations.routes.js';

export const createMainRouter = (db: Firestore) => {
  const router = express.Router();

  // Mount the routers on the main router
  router.use(healthCheckRouter);
  // router.use(jwksRouter); // Kept commented out as per original file
  router.use(googleAuthRoutes);

  router.use(createUserApiRoutes(db));

  // 2. Mount the integrations router under /integrations
  // e.g. POST /api/integrations/google/link
  router.use('/auth/integrations', createIntegrationsRouter(db));

  return router;
};
