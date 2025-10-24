import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import type { User } from '@nx-platform-application/platform-types';

export const signOptions: jwt.SignOptions = {
  expiresIn: '15m',
  algorithm: 'RS256',
  keyid: 'main-signing-key',
};

/**
 * Generates a signed internal JWT for an authenticated user using the RS256 algorithm.
 *
 * @param user - The authenticated user object from our Firestore database.
 * @param providerIdToken - The original, unmodified ID token from the external provider.
 * @returns A signed JWT string.
 */
export function generateToken(user: User, providerIdToken: string): string {
  const payload = {
    iss: 'node-identity-service',
    sub: user.id,
    aud: config.jwtAudience,
    alias: user.alias,
    email: user.email,
    original_identity: {
      provider: 'google',
      id_token: providerIdToken,
    },
  };

  return jwt.sign(payload, config.jwtPrivateKey, signOptions);
}
