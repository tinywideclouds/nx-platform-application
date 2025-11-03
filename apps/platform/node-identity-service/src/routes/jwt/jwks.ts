import { Router } from 'express';
import { createPublicKey } from 'node:crypto'; // <-- 1. IMPORT the public key creator
import { config } from '../../config.js';
import { signOptions } from '../../internal/services/jwt.service.js';
import * as jose from 'jose';

const router = Router();

// A cache to hold the generated JWKS to avoid regenerating it on every request.
let jwksCache: { keys: jose.JWK[] } | null = null;

/**
 * Generates (or retrieves from cache) the JSON Web Key Set for the service.
 * This function is now called explicitly from main.ts during startup.
 */
export async function generateJwks() {
  if (jwksCache) {
    return jwksCache;
  }

  try {
    // THE FIX: We first create a public key object from the private key string.
    // This ensures that only the public components are used for the JWK.
    const publicKey = createPublicKey(config.jwtPrivateKey);

    // Now, exportJWK will only export the public parts of the key.
    const jwk = await jose.exportJWK(publicKey);

    // The JWKS must include a key ID ('kid') so clients know which key to use.
    jwk.kid = 'main-signing-key';
    jwk.alg = 'RS256';
    jwk.use = 'sig'; // The key is used for signing

    // The final JWKS is an object containing an array of keys.
    jwksCache = { keys: [jwk] };
    return jwksCache;
  } catch (error) {
    // Throw a new, clear error to be caught by the main startup function.
    throw new Error('Could not generate JWKS from the provided private key.', {
      cause: error,
    });
  }
}

router.get('/.well-known/jwks.json', async (_req, res) => {
  // The JWKS is guaranteed to be generated at startup, so we can safely use it.
  res.json(jwksCache);
});

router.get('/.well-known/oauth-authorization-server', async (req, res) => {
  console.log('trying');

  // --- THIS IS THE FIX ---
  // 1. Get the protocol (http)
  const protocol = req.protocol;
  // 2. Get the host from the request header (e.g., 'localhost:3000' or 'host.docker.internal:3000')
  const host = req.get('host');
  // 3. Build the dynamic issuer URL
  const issuer = `${protocol}://${host}`;

  // Build the metadata object dynamically from the request.
  const metadata = {
    // 1. Use the dynamic issuer URL
    issuer: issuer,

    // 2. Construct the JWKS URI using the dynamic issuer URL.
    jwks_uri: `${issuer}/.well-known/jwks.json`,

    // 3. Get the supported algorithm (this is still static)
    id_token_signing_alg_values_supported: [signOptions.algorithm],
  };

  res.json(metadata);
});

export const jwksRouter = router;
