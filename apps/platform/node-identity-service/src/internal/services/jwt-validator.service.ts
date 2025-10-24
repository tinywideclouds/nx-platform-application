import { createLocalJWKSet, jwtVerify } from 'jose';
import { generateJwks } from '../../routes/jwt/jwks.js';
import { generateToken } from './jwt.service.js';

/**
 * A startup service to validate the JWT configuration.
 * It performs a self-test by signing a token with the production signing function
 * and then verifying it using the production JWKS generation function.
 * This guarantees that the private key is valid and that the signing and
 * verification libraries (`jsonwebtoken` and `jose`) are compatible.
 */
export async function validateJwtConfiguration(): Promise<void> {
  console.log('[INFO] Performing JWT configuration self-test...');

  try {
    // 1. Generate the JWKS from the private key. This implicitly validates
    //    that the private key is well-formed for the `jose` library.
    const jwks = await generateJwks();
    if (!jwks || !jwks.keys || jwks.keys.length === 0) {
      throw new Error('JWKS generation resulted in an empty key set.');
    }

    // 2. Create a local JWKSet client to simulate the verifier role.
    //    This is what remote services will effectively do.
    const localJWKSet = createLocalJWKSet(jwks);

    // 3. Create a dummy user payload to sign a realistic token.
    // NOTE this is NOT placeholder code it is verification code for startup
    const testUser = {
      id: 'validation-test-sub',
      email: 'test@validation.local',
      alias: 'Validator',
    };

    // 4. Sign a token using the actual production function.
    const testToken = generateToken(testUser, 'dummy-provider-token');

    // 5. Verify the token using the JWKS. If this passes, our entire
    //    signing and verification pipeline is confirmed to be working correctly.
    await jwtVerify(testToken, localJWKSet);

    console.log('[SUCCESS] JWT configuration self-test passed.');
  } catch (error: any) {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('!!!     FATAL: JWT CONFIGURATION SELF-TEST FAILED    !!!');
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');

    // Provide a clear, actionable error message.
    if (error.code === 'ERR_JWK_INVALID') {
      console.error(
        '\nREASON: The JWT_PRIVATE_KEY is likely malformed or invalid.'
      );
    } else if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      console.error(
        '\nREASON: Signature verification failed. This indicates an issue between the signing key and the generated public key.'
      );
    } else {
      console.error('\nREASON:', error.message);
    }

    // Re-throw the error to halt server startup.
    throw error;
  }
}
