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
import { environment } from './environments/environment';

// --- Auth Providers (Existing) ---
import {
  authInterceptor,
  IAuthService,
  AuthService,
  AUTH_API_URL,
} from '@nx-platform-application/platform-auth-data-access';
import { MockAuthService } from './auth/mocks/mock-auth.service';

// --- Mock Providers (from Phase 1) ---
import { ChatService } from '@nx-platform-application/chat-state';
import { MockChatService } from './mocks/mock-chat.service';
import { ContactsStorageService } from '@nx-platform-application/contacts-data-access';
import { MockContactsStorageService } from './mocks/mock-contacts-storage.service';

// --- 1. IMPORT ALL REQUIRED SERVICE TOKENS ---
import {
  ChatDataService, // (Import one to get the path)
  ROUTING_SERVICE_URL,
} from '@nx-platform-application/chat-data-access';
import {
  ChatLiveDataService, // (Import one to get the path)
  WSS_URL_TOKEN,
} from '@nx-platform-application/chat-live-data';
import {
  SecureKeyService, // (Import one to get the path)
  KEY_SERVICE_URL,
} from '@nx-platform-application/messenger-key-access';
// --- (End of new imports) ---

import { CryptoEngine } from '@nx-platform-application/messenger-crypto-access';
import { LOGGER_CONFIG, LogLevel } from '@nx-platform-application/console-logger';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

// --- Conditional Mock Providers ---
const authProvider = environment.useMocks
  ? { provide: IAuthService, useClass: MockAuthService }
  : { provide: IAuthService, useClass: AuthService };

const chatProvider = environment.useMocks
  ? { provide: ChatService, useClass: MockChatService }
  : [];

const contactsProvider = environment.useMocks
  ? { provide: ContactsStorageService, useClass: MockContactsStorageService }
  : [];

// --- 2. ADD CONDITIONAL DEV PROVIDERS ---
// These provide the *real* URLs *only* when not in mock mode.
const devProviders = environment.useMocks
  ? []
  : [
      {
        provide: AUTH_API_URL,
        useValue: environment.identityServiceUrl,
      },
      {
        provide: ROUTING_SERVICE_URL,
        useValue: environment.routingServiceUrl,
      },
      {
        provide: KEY_SERVICE_URL,
        useValue: environment.keyServiceUrl,
      },
      {
        provide: WSS_URL_TOKEN,
        useValue: environment.wssUrl,
      },
    ];
// --- (End of new providers) ---

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

    // --- 3. ADD ALL PROVIDERS TO THE ARRAY ---
    authProvider,
    chatProvider,
    contactsProvider,
    ...devProviders, // <-- Spreads the correct URL tokens or []
    // --- (End of provider list changes) ---
    
    {
      provide: LOGGER_CONFIG,
      useValue: {
        level: isDevMode() ? LogLevel.DEBUG : LogLevel.WARN,
      },
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