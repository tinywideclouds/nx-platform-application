// apps/platform/node-identity-service/src/config.ts

import pino from 'pino';

/**
 * A minimal, synchronous logger for use ONLY during the initial config validation.
 * It ensures that fatal startup errors are logged as structured JSON
 * before the main application logger is available.
 */
const bootstrapLogger = pino({
  level: 'info',
});

// 1. Define the possible policy types
export type AuthPolicy = 'ALLOW_ALL' | 'MEMBERSHIP' | 'BLOCK';

/**
 * Defines the shape of the application's configuration object.
 */
interface Config {
  issuer: string;
  port: number;
  clientUrl: string;
  sessionSecret: string;
  jwtSecret: string;
  jwtAudience: string;
  jwtPrivateKey: string;
  gcpProjectId: string | undefined;
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;
  googleRedirectUrlSuccess: string;
  googleRedirectUrlFailure: string;
  googleAuthCallback: string;
  internalApiKey: string | undefined;
  enableRateLimiter: boolean;
  e2eTestSecret: string | undefined;
  // 2. Add the new authPolicy property
  authPolicy: AuthPolicy;
}

// Store the default (insecure) secrets in constants.
const DEFAULT_SESSION_SECRET = 'a-very-secret-key-for-dev';
const DEFAULT_JWT_SECRET = 'a-different-very-secret-key-for-dev';
const DEFAULT_JWT_PRIVATE_KEY =
  'a-crypto-lib-private-key-from-public-private-pair';

// 3. Helper to validate the auth policy from process.env
function getAuthPolicy(): AuthPolicy {
  const policy = process.env.AUTH_POLICY || 'ALLOW_ALL';
  if (policy === 'ALLOW_ALL' || policy === 'MEMBERSHIP' || policy === 'BLOCK') {
    return policy;
  }
  // Fallback for invalid values
  bootstrapLogger.warn(
    `Invalid AUTH_POLICY "${policy}". Defaulting to "ALLOW_ALL".`
  );
  return 'ALLOW_ALL';
}

/**
 * A centralized, type-safe configuration object for the application.
 */
export const config: Config = {
  issuer: process.env.ISSUER || 'http://localhost',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:4200',
  sessionSecret: process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET,
  jwtSecret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  jwtPrivateKey: process.env.JWT_PRIVATE_KEY || DEFAULT_JWT_PRIVATE_KEY,
  jwtAudience: process.env.JWT_AUDIENCE || '',
  gcpProjectId: process.env.GCP_PROJECT_ID,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleAuthCallback:
    process.env.GOOGLE_AUTH_CALLBACK || '/api/auth/google/callback',
  googleRedirectUrlSuccess:
    process.env.GOOGLE_REDIRECT_URL_SUCCESS ||
    'http://localhost:4200/login-success',
  googleRedirectUrlFailure:
    process.env.GOOGLE_REDIRECT_URL_FAILURE ||
    'http://localhost:4200/login?error=unauthorized',
  internalApiKey: process.env.INTERNAL_API_KEY,
  enableRateLimiter: process.env.ENABLE_RATE_LIMITER
    ? process.env.ENABLE_RATE_LIMITER === 'true'
    : true,
  e2eTestSecret: process.env.E2E_TEST_SECRET,
  // 4. Read the policy from the environment
  authPolicy: getAuthPolicy(),
};

// --- Runtime Validation ---

// Map config keys to the exact ENV variable name for clear errors.
const requiredConfigMap: Record<keyof Config, string> = {
  gcpProjectId: 'GCP_PROJECT_ID',
  googleClientId: 'GOOGLE_CLIENT_ID',
  googleClientSecret: 'GOOGLE_CLIENT_SECRET',
  googleRedirectUrlSuccess: 'GOOGLE_REDIRECT_URL_SUCCESS',
  googleRedirectUrlFailure: 'GOOGLE_REDIRECT_URL_FAILURE',
  googleAuthCallback: 'GOOGLE_AUTH_CALLBACK',
  jwtSecret: 'JWT_SECRET',
  jwtAudience: 'JWT_AUDIENCE',
  jwtPrivateKey: 'JWT_PRIVATE_KEY',
  internalApiKey: 'INTERNAL_API_KEY',
  sessionSecret: 'SESSION_SECRET',
  clientUrl: 'CLIENT_URL',
  // --- These are not checked here ---
  issuer: '',
  port: '',
  enableRateLimiter: '',
  e2eTestSecret: '',
  authPolicy: '', // Not "required", as it has a safe default
};

try {
  // 1. General required configuration check
  for (const key of Object.keys(requiredConfigMap) as Array<keyof Config>) {
    const envVarName = requiredConfigMap[key];
    if (envVarName && !config[key]) {
      throw new Error(
        `Missing required environment variable: ${envVarName}. Please ensure this variable is set in your .env file.`
      );
    }
  }

  // 2. Environment-specific validation
  if (process.env.NODE_ENV === 'production') {
    // --- PRODUCTION CHECKS ---
    if (config.sessionSecret === DEFAULT_SESSION_SECRET) {
      throw new Error(
        'INSECURE: The default SESSION_SECRET is being used in a production environment. Please generate a secure, random secret.'
      );
    }
    if (config.jwtSecret === DEFAULT_JWT_SECRET) {
      throw new Error(
        'INSECURE: The default JWT_SECRET is being used in a production environment. Please generate a secure, random secret.'
      );
    }
    if (config.jwtPrivateKey === DEFAULT_JWT_PRIVATE_KEY) {
      throw new Error(
        'INSECURE: The default JWT_PRIVATE_KEY is being used in a production environment. Please generate a real RSA private key.'
      );
    }
    if (config.e2eTestSecret) {
      throw new Error(
        'INSECURE: E2E_TEST_SECRET must not be set in a production environment. This variable is for testing only.'
      );
    }
  } else {
    // --- NON-PRODUCTION CHECKS ---
    if (!config.e2eTestSecret) {
      throw new Error(
        'Missing required testing variable: E2E_TEST_SECRET. This is required for non-production environments.'
      );
    } else {
      console.warn("[WARNING] E2E_TEST_SECRET is set. Ensure this is only used in testing environments.", config.e2eTestSecret);
    }
  }
} catch (error) {
  // Use the bootstrap logger for a structured fatal error
  bootstrapLogger.fatal(
    {
      type: 'ConfigValidation',
      err: error,
    },
    `[FATAL] Configuration validation failed: ${(error as Error).message}`
  );
  // Exit the process, as this is a non-recoverable error
  process.exit(1);
}