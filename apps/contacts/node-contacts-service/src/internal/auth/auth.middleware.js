import { createJwtAuthMiddleware } from '@nx-platform-application/node-auth';
import { config } from '../../config.js';

/**
 * The authentication middleware for this service.
 *
 * It uses the centralized 'platform-node-auth' library, providing
 * our service's specific configuration for the identity service URL.
 *
 * The 'platform-node-auth' library handles all:
 * - JWKS discovery from the identity-service
 * - Token validation (signature, expiry, etc.)
 * - Attaching the 'req.user' object
 */
export const authMiddleware = createJwtAuthMiddleware(config.identityServiceUrl);
