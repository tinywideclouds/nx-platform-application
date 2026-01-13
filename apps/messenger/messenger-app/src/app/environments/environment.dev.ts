import { LogLevel } from '@nx-platform-application/platform-tools-console-logger';

// This file configures the application to run against the real identity-service
export const environment = {
  production: false,
  useMocks: false,
  identityServiceUrl: '/api/auth',
  keyServiceUrl: '/api/keys',
  routingServiceUrl: '/api/routing',
  notificationServiceUrl: '/api/notifications',
  enableServiceWorker: true,
  wssUrl: 'ws://localhost:4200/connect',
  googleClientId:
    '885150127230-v1co0gles0clk1ara7h63qirvcjd59g8.apps.googleusercontent.com',
  vapidPublicKey:
    'BAE-OyH4wq6oJIulBi6d_DCA8djt9gbKR3az6zxkEQJJN5NA5zaCwiPjliGtrzgXfx70JC8_4NrQ-aUlqnpW0gY',

  logLevel: 'debug',
};
