import type { Request, Response, NextFunction } from 'express';
import { config } from '../../config.js';

/**
 * An Express middleware that ensures a request is from a trusted E2E test runner.
 *
 * It validates a secret key provided in the 'x-e2e-secret-key' header.
 * This middleware is intended ONLY for non-production environments to protect
 * test-only endpoints.
 */
export function e2eAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 1. Check if the environment is production.
  //    This is a critical defense-in-depth check. This middleware should
  //    never even be loaded in production, but if it is, it must fail safe.
  if (process.env.NODE_ENV === 'production') {
    res
      .status(404)
      .json({ error: 'Endpoint not found.' });
    return;
  }

  // 2. Validate the secret key from the header.
  const providedKey = req.headers['x-e2e-secret-key'];

  if (!providedKey || providedKey !== config.e2eTestSecret) {
    res.status(401).json({ error: 'Unauthorized: Invalid E2E secret key.' });
    return;
  }

  // 3. Key is valid, proceed to the handler.
  next();
}
