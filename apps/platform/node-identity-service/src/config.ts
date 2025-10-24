import 'dotenv/config';

/**
 * Defines the shape of the application's configuration object.
 * Using an interface provides type safety and autocompletion, preventing
 * common typos and making the code self-documenting.
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
}

// Store the default (insecure) secrets in constants. This makes them easy
// to reference for our security check later.
const DEFAULT_SESSION_SECRET = 'a-very-secret-key-for-dev';
const DEFAULT_JWT_SECRET = 'a-different-very-secret-key-for-dev';
const DEFAULT_JWT_PRIVATE_KEY =
  'a-crypto-lib-private-key-from-public-private-pair';

/**
 * A centralized, type-safe configuration object for the application.
 *
 * It loads all necessary environment variables at startup and provides
 * a single source of truth for configuration.
 */
export const config: Config = {
  issuer: process.env.ISSUER || 'http://localhost',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:4200',
  sessionSecret: process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET,
  jwtSecret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  jwtPrivateKey: process.env.JWT_PRIVATE_KEY || DEFAULT_JWT_PRIVATE_KEY,
  jwtAudience: process.env.JWT_AUDIENCE || '', // An audience should always be explicitly set
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
};

// --- Runtime Validation ---
// This block ensures the server fails fast if critical configuration is missing
// or insecure, providing clear and actionable error messages.

const requiredConfig: Array<keyof Config> = [
  'gcpProjectId',
  'googleClientId',
  'googleClientSecret',
  'googleRedirectUrlSuccess',
  'googleRedirectUrlFailure',
  'googleAuthCallback',
  'jwtSecret',
  'jwtAudience',
  'internalApiKey',
  'sessionSecret',
  'clientUrl',
];

for (const key of requiredConfig) {
  if (!config[key]) {
    console.error(
      `\n[FATAL] Missing required environment variable: ${key.toUpperCase()}`
    );
    console.error('Please ensure this variable is set in your .env file.\n');
    process.exit(1);
  }
}

// Security Check: In a production environment, refuse to start if default secrets are used.
// To run in production, set NODE_ENV=production in your environment.
if (process.env.NODE_ENV === 'production') {
  if (config.sessionSecret === DEFAULT_SESSION_SECRET) {
    console.error(
      '\n[FATAL] INSECURE: The default SESSION_SECRET is being used in a production environment.'
    );
    console.error(
      'Please generate a secure, random secret and set it in the .env file.\n'
    );
    process.exit(1);
  }
  if (config.jwtSecret === DEFAULT_JWT_SECRET) {
    console.error(
      '\n[FATAL] INSECURE: The default JWT_SECRET is being used in a production environment.'
    );
    console.error(
      'Please generate a secure, random secret and set it in the .env file.\n'
    );
    process.exit(1);
  }
}
