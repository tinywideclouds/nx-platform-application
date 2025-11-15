import {
  ApplicationConfig,
  APP_INITIALIZER,
  importProvidersFrom,
  isDevMode,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom } from 'rxjs';

import { appRoutes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';
import { environment } from './environments/environment';
import {
  IAuthService,
  AuthService,
} from '@nx-platform-application/platform-auth-data-access';
import { MockAuthService } from './auth/mocks/mock-auth.service';
import { CryptoEngine } from '@nx-platform-application/messenger-crypto-access';

// --- Logger Provider (if you have one) ---
// import { LOG_LEVEL, LogLevel } from '@nx-platform-application/console-logger';

// --- Material (if using mock login) ---
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

// Conditionally provide the real or mock AuthService
const authProvider = environment.useMocks
  ? { provide: IAuthService, useClass: MockAuthService }
  : { provide: IAuthService, useClass: AuthService };

// Factory for the APP_INITIALIZER
export function initializeAuthFactory(
  authService: IAuthService
): () => Promise<unknown> {
  return () => firstValueFrom(authService.sessionLoaded$);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes),
    provideAnimations(),
    provideHttpClient(withInterceptors([authInterceptor])),

    // --- Auth Providers ---
    authProvider,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuthFactory,
      deps: [IAuthService],
      multi: true,
    },

    // --- Logger ---
    // {
    //   provide: LOG_LEVEL,
    //   useValue: isDevMode() ? LogLevel.DEBUG : LogLevel.INFO,
    // },

    // --- Service Providers from earlier ---
    CryptoEngine,

    // --- Imports for Mock Login Component ---
    // You only need these if environment.useMocks is true
    importProvidersFrom(MatCardModule, MatButtonModule),
  ],
};