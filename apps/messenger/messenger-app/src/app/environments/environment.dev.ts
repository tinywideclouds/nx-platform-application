import { LogLevel } from '@nx-platform-application/console-logger';

// This file configures the application to run against the real identity-service
export const environment = {
  production: false,
  useMocks: false,
  identityServiceUrl: '/api/auth',
  keyServiceUrl: '/api/keys',
  routingServiceUrl: '/api/routing',
  wssUrl: 'socket',
  logLevel: 'debug',

  googleClientId:
    '885150127230-v1co0gles0clk1ara7h63qirvcjd59g8.apps.googleusercontent.com',
};
