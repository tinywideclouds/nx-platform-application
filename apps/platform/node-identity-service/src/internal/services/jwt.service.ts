// --- File: node-identity-service/internal/services/jwt.service.ts ---

import * as jose from 'jose'; 
import type { CryptoKey } from 'jose';
// [FIXED] Import the standard, publicly available KeyObject type from Node
import type { KeyObject } from 'node:crypto'; 
import { config } from '../../config.js';
import type { User } from '@nx-platform-application/platform-types';

/**
 * Defines the standard options for all JWTs issued by this service.
 */
export const signOptions = {
  algorithm: 'RS256',
  expiresIn: '15m',
  issuer: config.issuer, 
  audience: config.jwtAudience,
};

// Use the public Node type for the cached key storage.
let privateKey: KeyObject | CryptoKey | undefined;


/**
 * Loads and caches the private key. This function must be called once during startup.
 */
async function loadPrivateKey(): Promise<KeyObject | CryptoKey> {
    if (privateKey) return privateKey;

    try {
        // jose.importPKCS8 returns a CryptoKey or KeyObject. We can use KeyObject for storage.
        const key = await jose.importPKCS8(config.jwtPrivateKey, signOptions.algorithm);
        privateKey = key; 
        return privateKey;
    } catch (error) {
        console.error("FATAL ERROR: Could not load private key for signing.");
        throw error;
    }
}

/**
 * Generates a signed internal-use JWT for an authenticated user.
 *
 * @param user - The authenticated user object.
 * @param providerToken - The original id_token from the auth provider (e.g., Google).
 * @returns A signed JWT string Promise.
 */
export async function generateToken(user: User, providerToken: string): Promise<string> {
  if (!user || !user.id) {
    throw new Error('User object with an ID is required to generate a token.');
  }

  // Load the key object (runs once)
  const keyToSignWith = await loadPrivateKey();

  const payload = {
    sub: user.id,
    email: user.email,
    alias: user.alias,
    nonce: providerToken,
  };

  try {
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ 
        alg: signOptions.algorithm, 
        typ: 'JWT',
        kid: 'main-signing-key' 
      })
      .setSubject(user.id)
      .setIssuer(signOptions.issuer)
      .setAudience(signOptions.audience)
      .setExpirationTime(signOptions.expiresIn)
      .setIssuedAt()
      .sign(keyToSignWith); 

    return token;
  } catch (error: any) {
    throw new Error(`generateToken: Failed to sign token. Error: ${error.message}`);
  }
}