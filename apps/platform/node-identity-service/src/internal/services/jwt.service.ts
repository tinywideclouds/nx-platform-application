import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import type { User } from '@nx-platform-application/platform-types';

/**
 * Defines the standard options for all JWTs issued by this service.
 * We use RS256, an asymmetric algorithm, which allows downstream
 * services to verify tokens using only the public key.
 */
export const signOptions: jwt.SignOptions = {
  algorithm: 'RS256',
  expiresIn: '15m',
  // [CORRECT] The issuer is defined *only* here.
  issuer: config.issuer + ':' + config.port,
  audience: config.jwtAudience,
};

/**
 * Generates a signed internal-use JWT for an authenticated user.
 *
 * @param user - The authenticated user object.
 * @param providerToken - The original id_token from the auth provider (e.g., Google).
 * @returns A signed JWT string.
 */
export function generateToken(user: User, providerToken: string): string {
  if (!user || !user.id) {
    throw new Error('User object with an ID is required to generate a token.');
  }

  const privateKey = config.jwtPrivateKey;
  if (!privateKey) {
    throw new Error(
      'generateToken: config.jwtPrivateKey is undefined. The server is misconfigured.'
    );
  }

  const payload = {
    // Standard OIDC claims
    sub: user.id, // Subject (the user's unique ID)
    email: user.email,
    // [THE FIX] Removed 'iss: config.issuer + ':' + config.port' from here.
    // It was a duplicate of the option in signOptions and caused the crash.

    // Custom claims
    alias: user.alias,
    // The 'nonce' here is the original provider token, which can be
    // used for specific validation or auditing if required.
    nonce: providerToken,
  };

  try {
    // This call will now succeed.
    const token = jwt.sign(payload, privateKey, signOptions);
    return token;
  } catch (error: any) {
    // This catch block is still here for robustness
    if (error.message.includes('asymmetric key')) {
      throw new Error(
        `generateToken: Failed to sign token. The JWT_PRIVATE_KEY is not a valid PEM key. It started with: "${privateKey.substring(
          0,
          30
        )}..."`
      );
    }
    throw error;
  }
}
