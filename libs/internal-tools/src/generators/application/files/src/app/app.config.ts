import {ApplicationConfig, provideZonelessChangeDetection} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { appRoutes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor'; // 1. Import the interceptor
import { environment } from '../environments/environment';
import { IAuthService, AuthService } from '@nx-platform-application/platform-auth-data-access';
import { MockAuthService } from './auth/mocks/mock-auth.service';

// Conditionally create the provider
// Conditionally provide the correct implementation for the IAuthService token
const authProvider = environment.useMocks
  ? { provide: IAuthService, useClass: MockAuthService }
  : { provide: IAuthService, useClass: AuthService }; // Also provide the real service

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),

    provideRouter(appRoutes),
    provideAnimations(),
    provideHttpClient(
      withInterceptors([authInterceptor]) // 2. Add the interceptor here
    ),
    authProvider,
  ],
};
