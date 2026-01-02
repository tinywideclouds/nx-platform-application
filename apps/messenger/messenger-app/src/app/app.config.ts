import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideZonelessChangeDetection,
  importProvidersFrom,
} from '@angular/core';
// This acts as a hint to the Nx Graph that this app explicitly depends on contacts-ui
import '@nx-platform-application/contacts-ui';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
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
import { ChatService } from '@nx-platform-application/messenger-state-chat-session';
import { MockChatService } from './mocks/mock-chat.service';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { MockContactsStorageService } from './mocks/mock-contacts-storage.service';
import { MESSENGER_MOCK_USERS } from './mocks/users';

// --- Domain Services (Directly Provided) ---
import { ChatSyncService } from '@nx-platform-application/messenger-domain-chat-sync';

// --- Service Tokens ---
import { ROUTING_SERVICE_URL } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { WSS_URL_TOKEN } from '@nx-platform-application/messenger-infrastructure-live-data';
import { KEY_SERVICE_URL } from '@nx-platform-application/messenger-infrastructure-key-access';

// --- Notification Tokens ---
import {
  NOTIFICATION_SERVICE_URL,
  VAPID_PUBLIC_KEY,
} from '@nx-platform-application/messenger-infrastructure-device-notifications';

import { CryptoEngine } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import {
  LOGGER_CONFIG,
  LogLevel,
} from '@nx-platform-application/console-logger';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MockCloudProvider } from '@nx-platform-application/contacts-cloud-access';
import {
  PLATFORM_CLOUD_CONFIG,
  CLOUD_PROVIDERS,
  GoogleDriveService,
} from '@nx-platform-application/platform-cloud-access';
import { provideMessengerIdentity } from '@nx-platform-application/messenger-domain-identity-adapter';

// --- Infrastructure: Implementation & Ports ---
import {
  ChatStorageService,
  DexieOutboxStorage,
  DexieQuarantineStorage,
  // ✅ Ports are now imported from Infrastructure (The Contract Definition)
  HistoryReader,
  ConversationStorage,
  OutboxStorage,
  QuarantineStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';

// --- Conditional Mock Providers ---
const authProviders = environment.useMocks
  ? [MockAuthService, { provide: IAuthService, useExisting: MockAuthService }]
  : [{ provide: IAuthService, useExisting: AuthService }];

const chatProvider = environment.useMocks
  ? { provide: ChatService, useClass: MockChatService }
  : [];

const contactsProvider = environment.useMocks
  ? { provide: ContactsStorageService, useClass: MockContactsStorageService }
  : [];

const mockUserProvider = environment.useMocks
  ? { provide: MOCK_USERS_TOKEN, useValue: MESSENGER_MOCK_USERS }
  : [];

// --- Token Providers ---
const tokenProviders = environment.useMocks
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
      {
        provide: NOTIFICATION_SERVICE_URL,
        useValue: environment.notificationServiceUrl,
      },
      {
        provide: VAPID_PUBLIC_KEY,
        useValue: environment.vapidPublicKey,
      },
      {
        provide: PLATFORM_CLOUD_CONFIG,
        useValue: {
          googleClientId: environment.googleClientId,
        },
      },
    ];

const cloudProviders = environment.useMocks
  ? [{ provide: CLOUD_PROVIDERS, useClass: MockCloudProvider, multi: true }]
  : [{ provide: CLOUD_PROVIDERS, useClass: GoogleDriveService, multi: true }];

export function initializeAuthFactory(
  authService: IAuthService,
): () => Promise<unknown> {
  return () => firstValueFrom(authService.sessionLoaded$);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),

    provideRouter(appRoutes, withComponentInputBinding()),

    provideAnimations(),
    provideHttpClient(withInterceptors([authInterceptor])),

    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.enableServiceWorker,
      registrationStrategy: 'registerWhenStable:30000',
    }),

    ...authProviders,
    provideMessengerIdentity(),

    // ✅ Wiring Domain Ports to Infrastructure Implementation
    // Note: The Ports (Abstract Classes) and Implementations (Services)
    // both live in 'messenger-infrastructure-chat-storage' now.
    { provide: HistoryReader, useExisting: ChatStorageService },
    { provide: ConversationStorage, useExisting: ChatStorageService },
    { provide: OutboxStorage, useClass: DexieOutboxStorage },
    { provide: QuarantineStorage, useClass: DexieQuarantineStorage },

    chatProvider,
    contactsProvider,
    ...tokenProviders,
    mockUserProvider,
    ...cloudProviders,
    {
      provide: LOGGER_CONFIG,
      useValue: {
        level: LogLevel.DEBUG,
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
