import express from 'express';
import { Firestore } from '@google-cloud/firestore';

// ADDED: Import the shared User type for type safety
import type { User } from '@nx-platform-application/platform-types';
// ADDED: Import our structured logger
import { logger } from '../../internal/services/logger.service.js';

import { findUserByEmail } from '../../internal/firestore.js';
import { internalAuthMiddleware } from '../../internal/auth/network.middleware.js';
import { generateToken } from '../../internal/services/jwt.service.js';
// ADDED: Import the refactored middleware
import { ensureAuthenticated } from '../../internal/middleware/auth.middleware.js';

export const createUserApiRoutes = (db: Firestore) => {
  const router = express.Router();

  router.get('/api/auth/status', (req, res) => {
    if (req.isAuthenticated()) {
      // CHANGED: Use the shared 'User' type for consistency.
      const user = req.user as User;
      const token = generateToken(user, "session-authenticated-token");
      res.json({ authenticated: true, user: { ...user, token } });
    } else {
      res.json({ authenticated: false, user: null });
    }
  });

  router.get('/api/auth/refresh-token', ensureAuthenticated, (req, res) => {
    // CHANGED: Use the shared 'User' type.
    const user = req.user as User;
    const newInternalToken = generateToken(user, "re-issued-token-placeholder");
    res.json({ token: newInternalToken });
  });

  router.post('/api/auth/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) { return next(err); }
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.status(200).send();
      });
    });
  });

  router.get('/api/users/by-email/:email', internalAuthMiddleware, async (req, res, next) => {
    const { email } = req.params;
    if (email == undefined) {
      res.status(400).json({error: 'malformed request no email'});
      return;
    }
    try {
      const user = await findUserByEmail(db, email);
      if (user) {
        res.json({ id: user.id, alias: user.alias, email: user.email });
      } else {
        res.status(404).json({ error: 'User not found.' });
      }
    } catch (error: unknown) {
      // CHANGED: Replaced console.error with structured logging.
      logger.error({ err: error, email }, 'User lookup by email failed');
      // CHANGED: Pass the error to the central error handler for a consistent response.
      return next(error);
    }
  });

  return router;
};
