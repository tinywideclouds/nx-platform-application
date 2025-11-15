// This file configures the application to run against the real identity-service
export const environment = {
  production: false,
  useMocks: false, // <-- Explicitly disable mocks
  identityServiceUrl: '/api' // Use the proxy
  // Add any other backend URLs here as you add more services
};
