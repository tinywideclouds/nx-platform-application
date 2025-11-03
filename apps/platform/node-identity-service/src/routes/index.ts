import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { googleAuthRoutes } from './auth/google.js';
import { createUserApiRoutes } from './api/users.js';
import { jwksRouter } from './jwt/jwks.js';
import { healthCheckRouter } from './heath-check.js';

export const createMainRouter = (db: Firestore) => {
  const router = express.Router();

  // Mount the routers on the main router
  router.use(healthCheckRouter);
  // router.use(jwksRouter);
  router.use(googleAuthRoutes);

  router.use(createUserApiRoutes(db));

  return router;
};
