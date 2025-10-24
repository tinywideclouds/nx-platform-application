import 'dotenv/config';

/**
 * Defines the shape of the application's configuration object.
 * Using an interface provides type safety and autocompletion.
 */
interface Config {
  port: number;
  gcpProjectId: string;
  identityServiceUrl: string;
  internalApiKey: string;
}

/**
 * A centralized, type-safe configuration object for the application.
 *
 * It loads all necessary environment variables at startup and provides
 * a single source of truth for configuration.
 */
export const config: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  gcpProjectId: process.env.GCP_PROJECT_ID as string,
  identityServiceUrl: process.env.IDENTITY_SERVICE_URL as string,
  internalApiKey: process.env.INTERNAL_API_KEY as string,
};

// --- Runtime Validation ---
// This ensures the server fails fast if critical secrets are not configured,
// matching the pattern from the identity-service.
const requiredConfig: Array<keyof Config> = [
  'gcpProjectId',
  'identityServiceUrl',
  'internalApiKey',
];

let hasMissingConfig = false;

for (const key of requiredConfig) {
  console.log(key);
  if (!config[key]) {
    console.error(
      `\n[FATAL] Missing required environment variable: ${key}`
    );
    console.error('Please ensure this variable is set in your .env file.\n');
    hasMissingConfig = true;
  }
}

if (hasMissingConfig) {
  process.exit(1); // Exit if any required config is missing
}

// Security Check: In a production environment, refuse to start if default keys are used.
// This is a placeholder; you would replace 'YOUR_DEFAULT_KEY' with any insecure
// defaults you might have (e.g., from an .env.example).
if (process.env.NODE_ENV === 'production') {
  if (config.internalApiKey === 'YOUR_DEFAULT_KEY') {
    console.error(
      '\n[FATAL] INSECURE: A default INTERNAL_API_KEY is being used in a production environment.'
    );
    console.error(
      'Please generate a secure, random secret and set it in the .env file.\n'
    );
    process.exit(1);
  }
}

// Export the validated, immutable config object for the rest of the application to use.
export default Object.freeze(config);
