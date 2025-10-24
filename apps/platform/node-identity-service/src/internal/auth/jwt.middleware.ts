import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';

// [ADDED] - Import the shared monorepo type
import type { User } from '@nx-platform-application/platform-types';

// [ADDED] - This is the modern, module-safe way to add properties
// to the Express Request object, fixing the linter error.
declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

/**
 * An Express middleware that validates the internal JWT from the Authorization header.
 * This is for protecting server-to-server API endpoints.
 */
export function jwtMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res
      .status(401)
      .json({ error: 'Unauthorized: No or invalid token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Token is missing.' });
    return;
  }

  // [ADDED] - Added try...catch block to handle JWT errors
  try {
    const decodedPayload = jwt.verify(
      token,
      config.jwtSecret
    ) as jwt.JwtPayload;

    if (typeof decodedPayload.sub !== 'string') {
      throw new Error('Token payload is missing a valid "sub" claim.');
    }

    // [CHANGED] - Now constructs the shared 'User' type
    const user: User = {
      id: decodedPayload.sub,
      email: decodedPayload.email as string,
      alias: decodedPayload.alias as string,
    };

    req.user = user;
    next();
  } catch (error) {
    // Handle expired tokens, invalid signatures, etc.
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: `Unauthorized: ${error.message}` });
    } else {
      // Pass any other unexpected errors along
      next(error);
    }
  }
}
