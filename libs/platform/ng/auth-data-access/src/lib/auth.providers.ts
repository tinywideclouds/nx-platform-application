import { withInterceptors, provideHttpClient } from '@angular/common/http';
import { authInterceptor } from './auth.interceptor';

/**
 * Provides the HttpClient and the auth interceptor.
 * To be used in the `providers` array.
 */
export const provideAuth = () => {
  return provideHttpClient(withInterceptors([authInterceptor]));
};