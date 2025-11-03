import { Router, json, Request, Response } from 'express';
import type { User } from '@nx-platform-application/platform-types';
import { e2eAuthMiddleware } from '../../internal/middleware/e2e.middleware.js';
import { generateToken } from '../../internal/services/jwt.service.js';
import { logger } from '@nx-platform-application/node-logger';

const router = Router();

/**
 * Defines the shape of the expected request body for generating a test token.
 * We only need the core components of the User type.
 */
type GenerateTokenRequest = Pick<User, 'id' | 'email' | 'alias'>;

/**
 * POST /api/e2e/generate-test-token
 *
 * An endpoint for E2E tests ONLY.
 * It is protected by the e2eAuthMiddleware.
 *
 * Accepts a JSON body with mock user details and returns a valid,
 * signed RS256 JWT for that user.
 */
router.post(
  '/e2e/generate-test-token',
  // 1. Protect this endpoint with our E2E secret
  e2eAuthMiddleware,
  // 2. Add middleware to parse the JSON body
  json(),
  // 3. Handle the request
  (req: Request, res: Response) => {
    // We can cast the body, but we must validate it.
    const body = req.body as GenerateTokenRequest;

    // Basic validation
    if (!body.id || !body.email || !body.alias) {
      logger.warn(
        { body },
        'E2E token generation request failed validation.'
      );
      return res.status(400).json({
        error: 'Invalid request body. Must include id, email, and alias.',
      });
    }

    try {
      // Construct the mock user object
      const mockUser: User = {
        id: body.id,
        email: body.email,
        alias: body.alias,
      };

      // Use the *real* production token service to generate the token
      // We use a placeholder for the "providerToken" as it's not
      // critical for the token's signature.
      const token = generateToken(mockUser, 'e2e-provider-token-placeholder');

      logger.info(
        { userId: mockUser.id, email: mockUser.email },
        'Generated E2E test token'
      );

      // Send the token back to the test runner
      res.status(200).json({ token });
    } catch (error) {
      logger.error({ err: error, body }, 'E2E token generation failed.');
      res.status(500).json({ error: 'Failed to generate token.' });
    }
  }
);

export const e2eRoutes = router;
