// This file configures the application to run against the real identity-service
export const environment = {
  production: false,
  useMocks: false, // <-- Explicitly disable mocks
  identityServiceUrl: 'http://localhost:3000', // <-- URL for your local identity-service
  // Add any other backend URLs here as you add more services
};
