// [ADDED] Import crypto to generate a real key pair
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { generateToken, signOptions } from './jwt.service.js';
import type { User } from '@nx-platform-application/platform-types';

// --- Mocks ---
// We must mock the config module to inject our generated key
vi.mock('../../config.js', async (importOriginal) => {
  // Get the actual config to avoid mocking all of it
  const actualConfig = await importOriginal<typeof import('../../config.js')>();
  return {
    config: {
      ...actualConfig.config,
      // We will override jwtPrivateKey inside the test
      jwtPrivateKey: 'placeholder-before-test-runs',
    },
  };
});

// Re-import the (now-mockable) config
import { config } from '../../config.js';
// --- End Mocks ---

describe('JWT Service (jwt.service.ts)', () => {
  let testPrivateKey: string;
  let testPublicKey: KeyObject;

  // [THE FIX] Before any tests run, generate a fresh key pair.
  beforeAll(() => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
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
    testPrivateKey = privateKey;
    testPublicKey = publicKey;
  });

  beforeEach(() => {
    // Inject the generated private key into the mocked config
    // for each test.
    vi.mocked(config, true).jwtPrivateKey = testPrivateKey;
  });

  it('should generate a valid RS256 JWT verifiable with the public key', () => {
    // ARRANGE
    const testUser: User = {
      id: 'test-user-123',
      email: 'test@example.com',
      alias: 'Test User',
    };
    const testIdToken = 'mock-google-id-token';

    // ACT
    // generateToken will now use the config, which we have
    // mocked to return our testPrivateKey
    const token = generateToken(testUser, testIdToken);

    // ASSERT
    expect(token).toEqual(expect.any(String));

    // Verify the token using the corresponding public key
    const decoded = jwt.verify(token, testPublicKey, {
      algorithms: ['RS256'],
      audience: signOptions.audience,
      issuer: signOptions.issuer,
    }) as jwt.JwtPayload;

    expect(decoded.sub).toBe(testUser.id);
    expect(decoded.email).toBe(testUser.email);
  });
});
