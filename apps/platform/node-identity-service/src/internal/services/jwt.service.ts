// apps/platform/node-identity-service/internal/services/jwt.service.ts

import * as jose from 'jose'; 
import type { CryptoKey } from 'jose';
import type { KeyObject } from 'node:crypto'; 
import { config } from '../../config.js';
import { URN } from '@nx-platform-application/platform-types';
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

let privateKey: KeyObject | CryptoKey | undefined;

/**
 * Loads and caches the private key. This function must be called once during startup.
 */
async function loadPrivateKey(): Promise<KeyObject | CryptoKey> {
    if (privateKey) return privateKey;

    try {
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
 * @param user - The authenticated user object (with federated URN).
 * @param providerToken - The original id_token from the auth provider (e.g., Google).
 * @returns A signed JWT string Promise.
 */
export async function generateToken(user: User, providerToken: string): Promise<string> {
  if (!user || !user.id) {
    throw new Error('User object with an ID is required to generate a token.');
  }

  // Load the key object (runs once)
  const keyToSignWith = await loadPrivateKey();
  let handleUrnString: string | undefined;
  if (user.email) {
    // Creates: urn:lookup:email:tim@xythings.com
    handleUrnString = URN.create('email', user.email, 'lookup').toString();
  }

  // 1. FIX: The 'sub' claim is set via .setSubject(), not in the payload.
  const payload = {
    email: user.email,
    alias: user.alias,
    handle: handleUrnString,
    nonce: providerToken,
  };

  try {
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ 
        alg: signOptions.algorithm, 
        typ: 'JWT',
        kid: 'main-signing-key' 
      })
      // 2. FIX: Convert the URN to a string for the 'sub' claim
      .setSubject(user.id.toString()) 
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