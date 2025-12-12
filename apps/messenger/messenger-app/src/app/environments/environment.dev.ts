import { LogLevel } from '@nx-platform-application/console-logger';

// This file configures the application to run against the real identity-service
export const environment = {
  production: false,
  useMocks: false,
  identityServiceUrl: '/api/auth',
  keyServiceUrl: '/api/keys',
  routingServiceUrl: '/api/routing',
  notificationServiceUrl: '/api/notifications',
  wssUrl: 'ws://localhost:4200/connect',
  googleClientId:
    '885150127230-v1co0gles0clk1ara7h63qirvcjd59g8.apps.googleusercontent.com',
  vapidPublicKey:
    'BAGjVFOsTc9jCizI60rOc3Dn6LG5wyDzPHRPDGrPA0EM38b8kPxEFIqwRHghwCRuTwxphfbKIJOwxSZz9n0nMxk',

  logLevel: 'debug',
};
