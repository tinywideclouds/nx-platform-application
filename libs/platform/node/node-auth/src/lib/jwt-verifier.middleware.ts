import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import axios from 'axios';
// [FIXED] Import Request and Response explicitly from express
import { NextFunction, Request, Response } from 'express';
import { URN } from '@nx-platform-application/platform-types';

type JWKSClient = ReturnType<typeof createRemoteJWKSet>;

/**
 * [FIXED] Define the expected shape of our JWT payload.
 * This provides strong types and removes the index signature error.
 */
interface PlatformJWTPayload extends JWTPayload {
  sub: string;
  email: string;
  alias: string;
}

let jwksClientCache: JWKSClient | null = null;

async function getJwksClient(identityServiceUrl: string): Promise<JWKSClient> {
  if (jwksClientCache) {
    return jwksClientCache;
  }

  const metadataUrl = `${identityServiceUrl}/.well-known/oauth-authorization-server`;
  try {
    const response = await axios.get(metadataUrl);
    const jwksUri = response.data?.jwks_uri;
    if (!jwksUri) {
      throw new Error(
        'Identity service metadata is malformed: missing jwks_uri'
      );
    }
    jwksClientCache = createRemoteJWKSet(new URL(jwksUri));
    return jwksClientCache;
  } catch (err: any) {
    throw new Error(
      `[FATAL] Could not fetch JWKS from identity service at ${metadataUrl}. Error: ${err.message}`
    );
  }
}

export function createJwtAuthMiddleware(identityServiceUrl: string) {
  const jwksClientPromise = getJwksClient(identityServiceUrl);

  return async function jwtAuthMiddleware(
    req: Request, // This is now the Express Request type
    res: Response, // This is now the Express Response type
    next: NextFunction
  ): Promise<void> {
    const authHeader = req.headers.authorization; // This will now work
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401);
      return next(new Error('Unauthorized: No or invalid token provided.'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401);
      return next(new Error('Unauthorized: Token is missing.'));
    }

    try {
      const jwksClient = await jwksClientPromise;

      // [FIXED] Pass our interface as a generic to jwtVerify.
      // The payload object will now be of type PlatformJWTPayload.
      const { payload } = await jwtVerify<PlatformJWTPayload>(
        token,
        jwksClient
      );

      // We still do a runtime check for safety
      if (!payload.sub || !payload.email || !payload.alias) {
        throw new Error('Token payload is missing required claims.');
      }

      req.user = {
        id: URN.parse(payload.sub),
        email: payload.email,
        alias: payload.alias,
      };
      next();
    } catch (error) {
      const logger = (req as any).log || console;
      logger.warn({ err: error }, '[AUTH] JWT validation error');
      res.status(401);
      next(error);
    }
  };
}
