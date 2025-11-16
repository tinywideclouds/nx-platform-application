import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideZonelessChangeDetection,
  importProvidersFrom,
  isDevMode,
} from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { appRoutes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';
import { environment } from './environments/environment';
import {
  IAuthService,
  AuthService,
  AUTH_API_URL, // <-- 1. Import the token
} from '@nx-platform-application/platform-auth-data-access';
import { MockAuthService } from './auth/mocks/mock-auth.service';
import { CryptoEngine } from '@nx-platform-application/messenger-crypto-access';

// --- Logger Provider (if you have one) ---
import { LOGGER_CONFIG, LogLevel } from '@nx-platform-application/console-logger';

// --- Material (if using mock login) ---
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

// --- Mock Providers (from Phase 1) ---
import { ChatService } from '@nx-platform-application/chat-state';
import { MockChatService } from './mocks/mock-chat.service';
import { ContactsStorageService } from '@nx-platform-application/contacts-data-access';
import { MockContactsStorageService } from './mocks/mock-contacts-storage.service';

// Conditionally provide the real or mock AuthService
const authProvider = environment.useMocks
  ? { provide: IAuthService, useClass: MockAuthService }
  : { provide: IAuthService, useClass: AuthService };

// Conditionally provide the real or mock ChatService
const chatProvider = environment.useMocks
  ? { provide: ChatService, useClass: MockChatService }
  : [];

// Conditionally provide the real or mock ContactsStorageService
const contactsProvider = environment.useMocks
  ? { provide: ContactsStorageService, useClass: MockContactsStorageService }
  : [];
// --- (End of mock providers) ---

// Factory for the APP_INITIALIZER
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
    
    // All our conditional providers
    authProvider,
    chatProvider,
    contactsProvider,
    
    {
      provide: LOGGER_CONFIG,
      useValue: {
        level: isDevMode() ? LogLevel.DEBUG : LogLevel.WARN,
      },
    },

    // --- 2. ADD THE NEW TOKEN PROVIDER ---
    // This provides the '/api/auth' string to the
    // interceptor and the auth service.
    {
      provide: AUTH_API_URL,
      useValue: environment.identityServiceUrl,
    },

    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuthFactory,
      deps: [IAuthService],
      multi: true,
    },

    CryptoEngine,

    importProvidersFrom(MatCardModule, MatButtonModule),
  ],
};