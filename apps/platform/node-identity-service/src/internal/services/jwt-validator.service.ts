import { createLocalJWKSet, jwtVerify } from 'jose';
import { generateJwks } from '../../routes/jwt/jwks.js';
import { generateToken } from './jwt.service.js';
import type { Logger } from 'pino'; // Import Logger type

/**
 * A startup service to validate the JWT configuration.
 * It performs a self-test by signing a token with the production signing function
 * and then verifying it using the production JWKS generation function.
 * This guarantees that the private key is valid and that the signing and
 * verification libraries (`jsonwebtoken` and `jose`) are compatible.
 * * @param logger - The shared logger instance for structured logging.
 */
export async function validateJwtConfiguration(logger: Logger): Promise<void> {
  // Signature changed from () to (logger: Logger) to fix TS2554 error
  logger.info({ step: 'jwt_self_test' }, 'Performing JWT configuration self-test...');

  try {
    // 1. Generate the JWKS from the private key.
    const jwks = await generateJwks();
    if (!jwks || !jwks.keys || jwks.keys.length === 0) {
      throw new Error('JWKS generation resulted in an empty key set.');
    }

    // 2. Create a local JWKSet client to simulate the verifier role.
    const localJWKSet = createLocalJWKSet(jwks);

    // 3. Create a dummy user payload to sign a realistic token.
    const testUser = {
      id: 'validation-test-sub',
      email: 'test@validation.local',
      alias: 'Validator',
    };

    // 4. Sign a token using the actual production function.
    const testToken = generateToken(testUser, 'dummy-provider-token');

    // 5. Verify the token using the JWKS.
    await jwtVerify(testToken, localJWKSet);

    logger.info({ step: 'jwt_self_test', status: 'success' }, 'JWT configuration self-test passed.');
  } catch (error: any) {
    // Use logger.fatal for structured, unrecoverable error logging
    logger.fatal(
      {
        step: 'jwt_self_test',
        err: error,
        code: error.code // Include the JOSE error code
      },
      'FATAL: JWT CONFIGURATION SELF-TEST FAILED'
    );

    // Add actionable logging for clarity
    if (error.code === 'ERR_JWK_INVALID') {
      logger.fatal({ tip: 'Check JWT_PRIVATE_KEY format' }, 'REASON: The private key is likely malformed or invalid.');
    } else if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      logger.fatal({ tip: 'Check signing compatibility' }, 'REASON: Signing and verification libraries may be incompatible.');
    }

    // Re-throw the error to halt server startup.
    throw error;
  }
}
