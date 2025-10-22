import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  isDevMode,
  APP_INITIALIZER, // <-- 1. Import
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom } from 'rxjs'; // <-- 2. Import

import { appRoutes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';
import { environment } from '../environments/environment';
import {
  IAuthService,
  AuthService,
} from '@nx-platform-application/platform-auth-data-access';
import { MockAuthService } from './auth/mocks/mock-auth.service';
import { LOG_LEVEL, LogLevel } from '@nx-platform-application/logger';

// Conditionally provide the correct implementation for the IAuthService token
const authProvider = environment.useMocks
  ? { provide: IAuthService, useClass: MockAuthService }
  : { provide: IAuthService, useClass: AuthService };

// 3. Define the factory function for the initializer
export function initializeAuthFactory(
  authService: IAuthService
): () => Promise<unknown> {
  return () => firstValueFrom(authService.sessionLoaded$);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),

    provideRouter(appRoutes),
    provideAnimations(),
    provideHttpClient(withInterceptors([authInterceptor])),
    authProvider,
    {
      provide: LOG_LEVEL,
      useValue: isDevMode() ? LogLevel.DEBUG : LogLevel.INFO,
    },

    // 4. Add the APP_INITIALIZER provider
    // This blocks app startup until the first checkAuthStatus() call completes
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuthFactory,
      deps: [IAuthService], // Declare dependencies for the factory
      multi: true,
    },
  ],
};
