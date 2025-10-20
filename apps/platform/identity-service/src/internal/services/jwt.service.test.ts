import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../config.js';
import type { User } from '@nx-platform-application/platform-types';
import { generateToken, signOptions } from './jwt.service.js';

describe('generateToken', () => {
  let testPublicKey: string;
  let testPrivateKey: string;
  let originalPrivateKey: any;
  let originalAudience: any;

  beforeAll(() => {
    // Generate a real, valid key pair once for all tests in this suite.
    // This avoids hardcoding keys and ensures they are in the correct format.
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    testPublicKey = publicKey;
    testPrivateKey = privateKey;
  });

  beforeEach(() => {
    // Before each test, save the original config values and then
    // overwrite them with our dynamically generated test keys.
    originalPrivateKey = config.jwtPrivateKey;
    originalAudience = config.jwtAudience;

    config.jwtPrivateKey = testPrivateKey;
    config.jwtAudience = 'test-audience';
  });

  afterEach(() => {
    // After each test, restore the original config to ensure test isolation
    // and prevent side-effects on other tests.
    config.jwtPrivateKey = originalPrivateKey;
    config.jwtAudience = originalAudience;
  });

  it('should create a valid, verifiable JWT with the correct claims', () => {
    // 1. Setup: Define mock inputs
    const mockUser: User = {
      id: 'user-123',
      alias: 'testuser',
      email: 'test@example.com',
    };
    const mockProviderIdToken = 'provider-original-id-token-string';

    // 2. Act: Call the function to generate a real token using the test keys
    const token = generateToken(mockUser, mockProviderIdToken);

    // 3. Assert: Verify the token and its payload
    let decoded: jwt.JwtPayload | string = {};
    expect(() => {
      // Use the corresponding public key to verify the token's signature
      decoded = jwt.verify(token, testPublicKey, {
        algorithms: [signOptions.algorithm as jwt.Algorithm],
      });
    }).not.toThrow();

    // Check that 'decoded' is a valid payload object
    expect(typeof decoded).toBe('object');
    const payload = decoded as jwt.JwtPayload;

    // Check static claims
    expect(payload.iss).toBe('node-identity-service');
    expect(payload.sub).toBe(mockUser.id);
    expect(payload.aud).toBe('test-audience');
    expect(payload.alias).toBe(mockUser.alias);
    expect(payload.email).toBe(mockUser.email);
    expect(payload.original_identity).toEqual({
      provider: 'google',
      id_token: mockProviderIdToken,
    });

    // Check time-based claims (iat, exp)
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');

    // Verify that the expiration is set correctly (15 minutes from issue time)
    const fifteenMinutesInSeconds = 15 * 60;
    expect(payload.exp).toBe(payload.iat! + fifteenMinutesInSeconds);
  });
});

