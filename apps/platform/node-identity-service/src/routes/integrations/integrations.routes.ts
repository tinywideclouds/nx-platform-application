import { Router, Request, Response, NextFunction } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { logger } from '@nx-platform-application/node-logger';
import { User } from '@nx-platform-application/platform-types';

import { ensureAuthenticated } from '../../internal/middleware/auth.middleware.js';
import {
  saveIntegration,
  getIntegration,
  deleteIntegration,
  listIntegrations,
} from '../../internal/firestore.js';
import {
  exchangeAuthCode,
  refreshAccessToken,
  revokeToken,
} from '../../internal/services/google.service.js';

export const createIntegrationsRouter = (db: Firestore) => {
  const router = Router();

  // Apply auth guard to all routes in this router
  router.use(ensureAuthenticated);

  // --- 1. LINK (The Handshake) ---
  router.post(
    '/google/link',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { code } = req.body;
        const user = req.user as User;
        const userId = user.id.toString();

        if (!code) {
          res.status(400).json({ error: 'Missing auth code' });
          return;
        }

        // 1. Exchange Code for Tokens
        const tokens = await exchangeAuthCode(code);

        // 2. Security Check: Did we get a refresh token?
        // GIS SDK usually returns it on the first consent.
        // If missing, it means the user previously linked but we lost the record.
        // In a strict implementation, we might ask them to re-consent with 'prompt=consent'.
        // For now, we proceed if we have at least an access token, but warn if no refresh.
        if (!tokens.refreshToken) {
          logger.warn(
            { userId },
            '[Integrations] Google returned no refresh_token. User might need re-consent.',
          );
        }

        // 3. Save the "Forever Key" to Firestore
        if (tokens.refreshToken) {
          await saveIntegration(db, userId, 'google', {
            refreshToken: tokens.refreshToken,
            linkedAt: new Date().toISOString(),
            scope: tokens.scope,
            status: 'active',
          });
        }

        logger.info(
          { userId, provider: 'google' },
          '[Integrations] Link successful',
        );

        res.json({
          status: 'linked',
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // --- 2. REFRESH (The Silent Loop) ---
  router.get(
    '/google/token',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user as User;
        const userId = user.id.toString();

        // 1. Fetch the stored secret
        const integration = await getIntegration(db, userId, 'google');

        if (!integration || !integration.refreshToken) {
          res.status(404).json({ error: 'Integration not found or invalid' });
          return;
        }

        // 2. Call Google to get a fresh Access Token
        try {
          const freshTokens = await refreshAccessToken(
            integration.refreshToken,
          );

          res.json({
            accessToken: freshTokens.accessToken,
            expiresIn: freshTokens.expiresIn,
          });
        } catch (error: any) {
          // Special handling: If the Refresh Token is dead (revoked externally),
          // we should clean up our DB so the UI knows to ask for re-linking.
          if (error.message === 'REFRESH_TOKEN_INVALID') {
            logger.warn(
              { userId },
              '[Integrations] Refresh token invalid. Auto-cleaning.',
            );
            await deleteIntegration(db, userId, 'google');
            res
              .status(401)
              .json({ error: 'Integration expired. Please reconnect.' });
            return;
          }
          throw error; // Let central handler deal with network errors
        }
      } catch (error) {
        next(error);
      }
    },
  );

  // --- 3. DISCONNECT (The Kill Switch) ---
  router.delete(
    '/google',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user as User;
        const userId = user.id.toString();

        const integration = await getIntegration(db, userId, 'google');

        if (integration && integration.refreshToken) {
          // Fire and forget revocation (best effort)
          await revokeToken(integration.refreshToken);
        }

        // Always delete from DB to ensure "Disconnected" state
        await deleteIntegration(db, userId, 'google');

        logger.info({ userId, provider: 'google' }, '[Integrations] Unlinked');
        res.status(200).json({ status: 'unlinked' });
      } catch (error) {
        next(error);
      }
    },
  );

  // --- 4. STATUS (Integration Awareness) ---
  router.get(
    '/status',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user as User;
        const userId = user.id.toString();

        const map = await listIntegrations(db, userId);

        // Return a clean boolean map: { google: true, dropbox: false }
        res.json({
          google: !!map['google'],
          dropbox: !!map['dropbox'], // Future proofing
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
};
