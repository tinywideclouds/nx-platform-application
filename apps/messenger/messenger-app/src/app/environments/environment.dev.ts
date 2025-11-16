// This file configures the application to run against the real identity-service
export const environment = {
  production: false,
  useMocks: false, 
  identityServiceUrl: '/api/auth'
  // Add any other backend URLs here as you add more services
};
