import type { Request, Response, NextFunction } from 'express';
import { config } from '../../config.js';

export function internalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const providedKey = req.headers['x-internal-api-key'];

  if (!providedKey || providedKey !== config.internalApiKey) {
    res.status(401).json({ error: 'Unauthorized: Invalid internal API key.' });
    return;
  }

  next();
}
