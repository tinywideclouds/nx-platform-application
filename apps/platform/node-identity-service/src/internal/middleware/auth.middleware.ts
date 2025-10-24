import type { Request, Response, NextFunction } from 'express';

/**
 * An Express middleware that ensures a user has an active session.
 * If the user is authenticated, the request proceeds. Otherwise, it returns a 401 Unauthorized error.
 */
export const ensureAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'User is not authenticated.' });
};
