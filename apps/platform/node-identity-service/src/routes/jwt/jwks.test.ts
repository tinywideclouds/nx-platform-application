import express, { type Express } from 'express';
import request from 'supertest';
import * as crypto from 'node:crypto';
import { jwksRouter, generateJwks } from './jwks.js';
import { config } from '../../config.js';
import { signOptions } from '../../internal/services/jwt.service.js';
import * as jose from 'jose';

// --- Mocks ---

// Mock the config module
vi.mock('../../config.js', () => {
  // MOVED: Key generation is now INSIDE the factory
  // This resolves the hoisting ReferenceError.
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  // Return the mock config object
  return {
    config: {
      jwtPrivateKey: privateKey,
      issuer: 'http://mock-issuer:4000',
      port: '4000',
    },
  };
});

// Mock the sign options
vi.mock('../../internal/services/jwt.service.js', () => ({
  signOptions: {
    algorithm: 'RS256',
  },
}));

// Mock 'jose' for failure testing
vi.mock('jose', async (importOriginal) => {
  const original = await importOriginal<typeof jose>();
  return {
    ...original,
    exportJWK: vi.fn(original.exportJWK),
  };
});
// --- End Mocks ---

describe('JWKS and OIDC Routes', () => {
  let app: Express;

  beforeAll(async () => {
    // Generate the JWKS cache *before* any tests run
    await generateJwks();
  });

  beforeEach(() => {
    app = express();
    app.use(jwksRouter);
  });

  describe('GET /.well-known/jwks.json', () => {
    it('should return 200 and a valid JWKS with public key only', async () => {
      // ACT
      const response = await request(app).get('/.well-known/jwks.json');

      // ASSERT
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('keys');
      expect(Array.isArray(response.body.keys)).toBe(true);
      expect(response.body.keys.length).toBe(1);

      const jwk = response.body.keys[0];

      expect(jwk).toEqual(
        expect.objectContaining({
          kid: 'main-signing-key',
          alg: 'RS256',
          use: 'sig',
          kty: 'RSA',
          n: expect.any(String),
          e: 'AQAB',
        })
      );

      // CRITICAL: Ensure NO private key components are leaked
      expect(jwk).not.toHaveProperty('d');
      expect(jwk).not.toHaveProperty('p');
      expect(jwk).not.toHaveProperty('q');
    });
  });

  describe('GET /.well-known/oauth-authorization-server', () => {
    // --- THIS IS THE UPDATED TEST ---
    it('should return 200 and dynamic OIDC metadata based on the Host header', async () => {
      // ARRANGE
      // 1. Define a mock host we want to test against
      const mockHost = 'my-test-host.com';

      // 2. The expected issuer is now based on the mock host.
      //    (req.protocol defaults to 'http' in supertest)
      const expectedIssuer = `http://${mockHost}`;

      // ACT
      // 3. Make the request, but SET the 'Host' header
      const response = await request(app)
        .get('/.well-known/oauth-authorization-server')
        .set('Host', mockHost); // <-- This is the fix

      // ASSERT
      // 4. Assert that the response body uses the dynamic host
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        issuer: expectedIssuer,
        jwks_uri: `${expectedIssuer}/.well-known/jwks.json`,
        id_token_signing_alg_values_supported: [signOptions.algorithm],
      });
    });
  });
});

describe('generateJwks (failure case)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should throw a clear error if key generation fails', async () => {
    // ARRANGE
    vi.mocked(jose.exportJWK).mockRejectedValue(new Error('Test export error'));

    // We must re-import the module *after* the mock is set
    // and *after* vi.resetModules() has cleared the cache.
    const { generateJwks: freshGenerateJwks } = await import('./jwks.js');

    // ACT & ASSERT
    await expect(freshGenerateJwks()).rejects.toThrow(
      'Could not generate JWKS from the provided private key.'
    );
  });
});
