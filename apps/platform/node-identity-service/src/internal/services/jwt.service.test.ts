import { generateKeyPairSync } from 'node:crypto';
// [CHANGED] Import jose for verification
import * as jose from 'jose';
import { generateToken, signOptions } from './jwt.service.js';
import { URN, type User } from '@nx-platform-application/platform-types';

// --- Mocks ---
vi.mock('../../config.js', async (importOriginal) => {
  const actualConfig = await importOriginal<typeof import('../../config.js')>();
  return {
    config: {
      ...actualConfig.config,
      jwtPrivateKey: 'placeholder-before-test-runs',
    },
  };
});

import { config } from '../../config.js';
// --- End Mocks ---

describe('JWT Service (jwt.service.ts)', () => {
  let testPrivateKey: string;
  // [CHANGED] Store the public key as a PEM string
  let testPublicKey: string;

  beforeAll(() => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem', // Store as PEM string
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
    vi.mocked(config, true).jwtPrivateKey = testPrivateKey;
  });

  // [CHANGED] Test is now async
  it('should generate a valid RS256 JWT verifiable with jose', async () => {
    // ARRANGE
    const testUser: User = {
      id: URN.parse('test:auth:user:123'),
      email: 'test@example.com',
      alias: 'Test User',
    };
    const testIdToken = 'mock-google-id-token';

    // [CHANGED] Import the public key for jose
    const josePublicKey = await jose.importSPKI(testPublicKey, 'RS256');

    // ACT
    // [CHANGED] Await the async generateToken function
    const token = await generateToken(testUser, testIdToken);

    // ASSERT
    expect(token).toEqual(expect.any(String));

    // [CHANGED] Verify the token using jose.jwtVerify
    const { payload, protectedHeader } = await jose.jwtVerify(
      token,
      josePublicKey,
      {
        algorithms: ['RS256'],
        audience: signOptions.audience,
        issuer: signOptions.issuer,
      },
    );

    // Assert the payload
    expect(payload.sub).toBe(testUser.id);
    expect(payload.email).toBe(testUser.email);

    // [ADDED] Also assert the 'kid' header is set correctly
    expect(protectedHeader.kid).toBe('main-signing-key');
  });
});
