import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideZonelessChangeDetection,
  importProvidersFrom,
  isDevMode,
} from '@angular/core';
// This acts as a hint to the Nx Graph that this app explicitly depends on contacts-ui
import '@nx-platform-application/contacts-ui';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { appRoutes } from './app.routes';
import { environment } from './environments/environment';

// --- Auth Providers ---
import {
  authInterceptor,
  IAuthService,
  AuthService,
  AUTH_API_URL,
} from '@nx-platform-application/platform-auth-access';
import {
  MOCK_USERS_TOKEN,
  MockAuthService,
} from '@nx-platform-application/platform-auth-ui/mocks';

// --- Mock Providers ---
import { ChatService } from '@nx-platform-application/chat-state';
import { MockChatService } from './mocks/mock-chat.service';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { MockContactsStorageService } from './mocks/mock-contacts-storage.service';
// 1. Import the new mock user list
import { MESSENGER_MOCK_USERS } from './mocks/users';

// --- Service Tokens ---
import { ROUTING_SERVICE_URL } from '@nx-platform-application/chat-access';
import { WSS_URL_TOKEN } from '@nx-platform-application/chat-live-data';
import { KEY_SERVICE_URL } from '@nx-platform-application/messenger-key-access';

import { CryptoEngine } from '@nx-platform-application/messenger-crypto-bridge';
import {
  LOGGER_CONFIG,
  LogLevel,
} from '@nx-platform-application/console-logger';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

// ---
// 2. The app-specific user definitions are GONE from this file.
// ---

// --- Conditional Mock Providers ---
const authProviders = environment.useMocks
  ? [
      MockAuthService, // Provide the class itself
      { provide: IAuthService, useExisting: MockAuthService }, // Provide it for the interface
    ]
  : [{ provide: IAuthService, useExisting: AuthService }];

const chatProvider = environment.useMocks
  ? { provide: ChatService, useClass: MockChatService }
  : [];

const contactsProvider = environment.useMocks
  ? { provide: ContactsStorageService, useClass: MockContactsStorageService }
  : [];

// ---
// 3. The provider now references the imported MESSENGER_MOCK_USERS
// ---
const mockUserProvider = environment.useMocks
  ? { provide: MOCK_USERS_TOKEN, useValue: MESSENGER_MOCK_USERS }
  : [];

// --- Dev Providers (unchanged) ---
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

// Factory for the APP_INITIALIZER (unchanged)
export function initializeAuthFactory(
  authService: IAuthService
): () => Promise<unknown> {
  return () => firstValueFrom(authService.sessionLoaded$);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),

    provideRouter(appRoutes, withComponentInputBinding()),

    provideAnimations(),
    provideHttpClient(withInterceptors([authInterceptor])),

    // ---
    // 4. The providers list is now clean
    // ---
    ...authProviders,
    chatProvider,
    contactsProvider,
    ...devProviders,
    mockUserProvider, // <-- Provider remains

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
