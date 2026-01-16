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

// --- TEST MOCKS (For Simulation) ---
import {
  MockChatDataService,
  MockChatSendService,
  MockLiveService,
  MockKeyService,
} from '@nx-platform-application/lib-messenger-test-app-mocking';

// --- Provider Selection Logic ---

// 1. Auth Provider (Always Real or Mocked at Adapter Level)
const authProviders = [{ provide: IAuthService, useExisting: AuthService }];

// 2. Messenger Infrastructure Providers (Real vs Mock)
const messengerInfraProviders = environment.useMocks
  ? [
      { provide: ChatDataService, useClass: MockChatDataService },
      { provide: ChatSendService, useClass: MockChatSendService },
      { provide: ChatLiveDataService, useClass: MockLiveService },
      { provide: SecureKeyService, useClass: MockKeyService },
    ]
  : [
      // Real Services (implicitly provided via @Injectable({providedIn: 'root'})
      // but explicitly listed here if we need to override tokens, which we don't for these classes directly)
      // However, to ensure consistency, we leave the default classes active.
    ];

// 3. Token Providers (Config)
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
    ];

// 4. Cloud Providers (Storage + Config)
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

    // --- Dynamic Infra Switching ---
    ...messengerInfraProviders,
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
