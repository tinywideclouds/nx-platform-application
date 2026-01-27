import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideZonelessChangeDetection,
  importProvidersFrom,
} from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

import { appRoutes } from './app.routes';
import { environment } from './environments/environment';

// --- AUTH ---
import {
  authInterceptor,
  IAuthService,
  AuthService,
  AUTH_API_URL,
} from '@nx-platform-application/platform-infrastructure-auth-access';

// --- INFRASTRUCTURE ---
import {
  IChatDataService,
  ChatDataService,
  IChatSendService,
  ChatSendService,
  ROUTING_SERVICE_URL,
} from '@nx-platform-application/messenger-infrastructure-chat-access';
import {
  IChatLiveDataService,
  ChatLiveDataService,
  WSS_URL_TOKEN,
} from '@nx-platform-application/messenger-infrastructure-live-data';
import {
  ISecureKeyService,
  SecureKeyService,
  KEY_SERVICE_URL,
} from '@nx-platform-application/messenger-infrastructure-key-access';

// --- NOTIFICATIONS ---
import {
  PushNotificationService,
  NOTIFICATION_SERVICE_URL,
  VAPID_PUBLIC_KEY,
} from '@nx-platform-application/messenger-infrastructure-device-notifications';

// --- MOCKS ---
import {
  MockAuthService,
  MockChatDataService,
  MockChatSendService,
  MockLiveService,
  MockKeyService,
  MockVaultDriver,
  MockPushNotificationService,
  MockIntegrationApiService,
  MockCryptoEngine,
  MessengerScenarioDriver,
  MockDirectoryService, // ✅ Imported Mock Directory
} from '@nx-platform-application/lib-messenger-test-app-mocking';

// --- OTHER ---
import { CryptoEngine } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { provideMessengerIdentity } from '@nx-platform-application/messenger-domain-identity-adapter';
import { IntegrationApiService } from '@nx-platform-application/platform-infrastructure-drive-integrations';
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
  ContactsQueryApi,
  AddressBookApi,
  AddressBookManagementApi,
} from '@nx-platform-application/contacts-api';

import { ContactsStateService } from '@nx-platform-application/contacts-state';

// ✅ NEW: Directory APIs
import {
  DirectoryQueryApi,
  DirectoryMutationApi,
} from '@nx-platform-application/directory-api';

import {
  LOGGER_CONFIG,
  LogLevel,
} from '@nx-platform-application/platform-tools-console-logger';
import {
  VaultDrivers,
  PlatformStorageConfig,
  GoogleDriveDriver,
  GOOGLE_TOKEN_STRATEGY,
  IdentityServerStrategy,
} from '@nx-platform-application/platform-infrastructure-storage';

function initializeScenarioDriver(driver: MessengerScenarioDriver) {
  return () => driver.initialize();
}

export function initializeAuthFactory(authService: IAuthService) {
  return () => firstValueFrom(authService.sessionLoaded$);
}

// --- PROVIDERS ---

const authProviders = environment.useMocks
  ? [
      { provide: IAuthService, useExisting: MockAuthService },
      { provide: AuthService, useExisting: MockAuthService },
    ]
  : [{ provide: IAuthService, useExisting: AuthService }];

const cryptoProvider = environment.useMocks
  ? { provide: CryptoEngine, useClass: MockCryptoEngine }
  : CryptoEngine;

const notificationProviders = environment.useMocks
  ? [
      {
        provide: PushNotificationService,
        useExisting: MockPushNotificationService,
      },
    ]
  : [];

const infraProviders = environment.useMocks
  ? [
      { provide: IChatDataService, useExisting: MockChatDataService },
      { provide: IChatSendService, useExisting: MockChatSendService },
      { provide: IChatLiveDataService, useExisting: MockLiveService },
      { provide: ISecureKeyService, useExisting: MockKeyService },
      { provide: ChatDataService, useExisting: MockChatDataService },
      { provide: ChatSendService, useExisting: MockChatSendService },
      { provide: ChatLiveDataService, useExisting: MockLiveService },
      { provide: SecureKeyService, useExisting: MockKeyService },
    ]
  : [
      { provide: IChatDataService, useClass: ChatDataService },
      { provide: IChatSendService, useClass: ChatSendService },
      { provide: IChatLiveDataService, useClass: ChatLiveDataService },
      { provide: ISecureKeyService, useClass: SecureKeyService },
    ];

// ✅ Directory Providers Logic
const directoryProviders = environment.useMocks
  ? [
      { provide: DirectoryQueryApi, useExisting: MockDirectoryService },
      { provide: DirectoryMutationApi, useExisting: MockDirectoryService },
      MockDirectoryService, // Ensure Class is available for Driver
    ]
  : [
      // TODO: Add Real HTTP Directory Service here when ready
      // { provide: DirectoryQueryApi, useClass: HttpDirectoryService },
    ];

const tokenProviders = [
  { provide: AUTH_API_URL, useValue: environment.identityServiceUrl },
  ...(environment.useMocks
    ? []
    : [
        {
          provide: ROUTING_SERVICE_URL,
          useValue: environment.routingServiceUrl,
        },
        { provide: KEY_SERVICE_URL, useValue: environment.keyServiceUrl },
        { provide: WSS_URL_TOKEN, useValue: environment.wssUrl },
        {
          provide: NOTIFICATION_SERVICE_URL,
          useValue: environment.notificationServiceUrl,
        },
        { provide: VAPID_PUBLIC_KEY, useValue: environment.vapidPublicKey },
      ]),
];

const cloudProviders = environment.useMocks
  ? [
      {
        provide: PlatformStorageConfig,
        useValue: {
          googleClientId: environment.googleClientId,
          googleApiKey: 'MOCK_CLIENT_ID',
        },
      },
      { provide: VaultDrivers, useClass: MockVaultDriver, multi: true },
      { provide: IntegrationApiService, useClass: MockIntegrationApiService },
    ]
  : [
      {
        provide: PlatformStorageConfig,
        useValue: {
          googleClientId: environment.googleClientId,
          googleApiKey: environment.googelApiKey,
        },
      },
      { provide: GOOGLE_TOKEN_STRATEGY, useClass: IdentityServerStrategy },
      { provide: VaultDrivers, useClass: GoogleDriveDriver, multi: true },
    ];

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
    cryptoProvider,
    ...notificationProviders,
    ...infraProviders,
    ...directoryProviders, // ✅ Added Directory Mocks
    provideMessengerIdentity(),

    { provide: HistoryReader, useExisting: ChatStorageService },
    { provide: ConversationStorage, useExisting: ChatStorageService },
    { provide: OutboxStorage, useClass: DexieOutboxStorage },
    { provide: QuarantineStorage, useClass: DexieQuarantineStorage },

    { provide: ContactsQueryApi, useExisting: ContactsStateService },
    { provide: AddressBookApi, useExisting: ContactsStateService },
    { provide: AddressBookManagementApi, useExisting: ContactsStateService },

    ...tokenProviders,
    ...cloudProviders,
    { provide: LOGGER_CONFIG, useValue: { level: LogLevel.DEBUG } },

    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuthFactory,
      deps: [IAuthService],
      multi: true,
    },
    ...(environment.useMocks
      ? [
          {
            provide: APP_INITIALIZER,
            useFactory: initializeScenarioDriver,
            deps: [MessengerScenarioDriver],
            multi: true,
          },
        ]
      : []),

    importProvidersFrom(MatCardModule, MatButtonModule),
  ],
};
