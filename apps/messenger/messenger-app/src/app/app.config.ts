import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideZonelessChangeDetection,
  importProvidersFrom,
} from '@angular/core';
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
} from '@nx-platform-application/platform-infrastructure-auth-access';

// --- Mock Providers (App State Mocks) ---
import { AppState } from '@nx-platform-application/messenger-state-app';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { MockChatService } from './mocks/mock-chat.service';
import { MockContactsStorageService } from './mocks/mock-contacts-storage.service';

// --- Scenario Infrastructure Mocks ---
import {
  MockChatDataService,
  MockChatSendService,
  MockLiveService,
  MockKeyService,
} from '@nx-platform-application/lib-messenger-test-app-mocking';

// --- Contacts Infrastructure & API ---
import {
  ContactsQueryApi,
  AddressBookApi,
  AddressBookManagementApi,
  GatekeeperApi,
  GroupNetworkStorageApi,
} from '@nx-platform-application/contacts-api';

import { GroupNetworkStorage } from '@nx-platform-application/contacts-storage';
import { ContactsFacadeService } from '@nx-platform-application/contacts-state';

// --- Service Tokens ---
import {
  ChatDataService,
  ChatSendService,
  ROUTING_SERVICE_URL,
} from '@nx-platform-application/messenger-infrastructure-chat-access';
import {
  ChatLiveDataService,
  WSS_URL_TOKEN,
} from '@nx-platform-application/messenger-infrastructure-live-data';
import {
  SecureKeyService,
  KEY_SERVICE_URL,
} from '@nx-platform-application/messenger-infrastructure-key-access';

// --- Notification Tokens ---
import {
  NOTIFICATION_SERVICE_URL,
  VAPID_PUBLIC_KEY,
} from '@nx-platform-application/messenger-infrastructure-device-notifications';

import { CryptoEngine } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import {
  LOGGER_CONFIG,
  LogLevel,
} from '@nx-platform-application/platform-tools-console-logger';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

import { provideMessengerIdentity } from '@nx-platform-application/messenger-domain-identity-adapter';

// --- Infrastructure: Implementation & Ports ---
import {
  ChatStorageService,
  DexieOutboxStorage,
  DexieQuarantineStorage,
  HistoryReader,
  ConversationStorage,
  OutboxStorage,
  QuarantineStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';

import {
  VaultDrivers,
  PlatformStorageConfig,
  GoogleDriveDriver,
  GOOGLE_TOKEN_STRATEGY,
  IdentityServerStrategy,
} from '@nx-platform-application/platform-infrastructure-storage';

// --- Provider Selection Logic ---

// 1. Auth Provider
const authProviders = [{ provide: IAuthService, useExisting: AuthService }];

// 2. Existing Internal Mocks (State Layer)
// Note: If you use the Scenario Driver, you usually want the REAL AppState but Mocked Infra.
// I am keeping your existing logic here, but verify if you want to swap AppState too.
const chatProvider = environment.useMocks
  ? { provide: AppState, useClass: MockChatService }
  : [];

const contactsProvider = environment.useMocks
  ? { provide: ContactsStorageService, useClass: MockContactsStorageService }
  : [];

// 3. Infrastructure Mocks (The Scenario Driver Engine)
const infraMockProviders = environment.useMocks
  ? [
      // ✅ STEP 1: Register Concrete Classes (So ScenarioDriver can inject them)
      MockChatDataService,
      MockChatSendService,
      MockLiveService,
      MockKeyService,

      // ✅ STEP 2: Alias Tokens to use the EXISTING instances
      // This ensures the App and the Test Driver talk to the SAME object.
      { provide: ChatDataService, useExisting: MockChatDataService },
      { provide: ChatSendService, useExisting: MockChatSendService },
      { provide: ChatLiveDataService, useExisting: MockLiveService },
      { provide: SecureKeyService, useExisting: MockKeyService },
    ]
  : [];

// 4. Token Providers
const tokenProviders = [
  // ✅ FIX: AUTH_API_URL is required by the Real AuthService, regardless of mocks
  {
    provide: AUTH_API_URL,
    useValue: environment.identityServiceUrl,
  },
  // Only provide the Backend Service URLs if we are NOT using Infra Mocks
  ...(environment.useMocks
    ? []
    : [
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
      ]),
];

// 5. Cloud Providers
const cloudProviders = [
  {
    provide: PlatformStorageConfig,
    useValue: {
      googleClientId: environment.googleClientId,
    } as PlatformStorageConfig,
  },
  {
    provide: GOOGLE_TOKEN_STRATEGY,
    useClass: IdentityServerStrategy,
  },
  {
    provide: VaultDrivers,
    useClass: GoogleDriveDriver,
    multi: true,
  },
];

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

    // --- Contacts API Ports ---
    { provide: ContactsQueryApi, useExisting: ContactsFacadeService },
    { provide: AddressBookApi, useExisting: ContactsFacadeService },
    { provide: AddressBookManagementApi, useExisting: ContactsFacadeService },
    { provide: GatekeeperApi, useExisting: ContactsFacadeService },
    { provide: GroupNetworkStorageApi, useClass: GroupNetworkStorage },

    // --- Chat Domain Ports ---
    { provide: HistoryReader, useExisting: ChatStorageService },
    { provide: ConversationStorage, useExisting: ChatStorageService },
    { provide: OutboxStorage, useClass: DexieOutboxStorage },
    { provide: QuarantineStorage, useClass: DexieQuarantineStorage },

    chatProvider,
    contactsProvider,
    ...infraMockProviders, // ✅ Added Infrastructure Mocks
    ...tokenProviders,
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
