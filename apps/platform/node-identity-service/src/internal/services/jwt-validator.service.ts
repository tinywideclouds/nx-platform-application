// apps/platform/node-identity-service/src/internal/services/jwt-validator.service.ts

import { createLocalJWKSet, jwtVerify } from 'jose';
import { generateJwks } from '../../routes/jwt/jwks.js';
import { generateToken } from './jwt.service.js';
import type { Logger } from 'pino';
// 1. Import URN and User
import { URN, User } from '@nx-platform-application/platform-types';

/**
 * A startup service to validate the JWT configuration.
 * ... (docs)
 */
export async function validateJwtConfiguration(logger: Logger): Promise<void> {
  logger.info({ step: 'jwt_self_test' }, 'Performing JWT configuration self-test...');

  try {
    // 1. Generate the JWKS from the private key.
    const jwks = await generateJwks();
    if (!jwks || !jwks.keys || jwks.keys.length === 0) {
      throw new Error('JWKS generation resulted in an empty key set.');
    }

    // 2. Create a local JWKSet client to simulate the verifier role.
    const localJWKSet = createLocalJWKSet(jwks);

    // 3. FIX: Create a dummy user payload with a federated URN
    const testUser: User = {
      id: URN.parse('urn:auth:test:validation-test-sub'),
      email: 'test@validation.local',
      alias: 'Validator',
    };

    // 4. Sign a token using the actual production function.
    const testToken = await generateToken(testUser, 'dummy-provider-token');

    // 5. Verify the token using the JWKS.
    await jwtVerify(testToken, localJWKSet);

    logger.info({ step: 'jwt_self_test', status: 'success' }, 'JWT configuration self-test passed.');
  } catch (error: any) {
    logger.fatal(
      {
        step: 'jwt_self_test',
        err: error,
        code: error.code
      },
      'FATAL: JWT CONFIGURATION SELF-TEST FAILED'
    );

    if (error.code === 'ERR_JWK_INVALID') {
      logger.fatal({ tip: 'Check JWT_PRIVATE_KEY format' }, 'REASON: The private key is likely malformed or invalid.');
    } else if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      logger.fatal({ tip: 'Check signing compatibility' }, 'REASON: Signing and verification libraries may be incompatible.');
    }

    // Re-throw the error to halt server startup.
    throw error;
  }
}