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

// --- Mock Providers ---
import { ChatService } from '@nx-platform-application/messenger-state-chat-session';
import { MockChatService } from './mocks/mock-chat.service';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { MockContactsStorageService } from './mocks/mock-contacts-storage.service';

// --- Contacts Infrastructure & API ---
import {
  ContactsFacadeService,
  ContactsQueryApi,
  AddressBookApi,
  AddressBookManagementApi,
  GatekeeperApi,
  GroupNetworkStorageApi,
} from '@nx-platform-application/contacts-api';

import { GroupNetworkStorage } from '@nx-platform-application/contacts-storage';

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

// ✅ NEW: Platform Infrastructure Storage
import {
  VaultDrivers,
  PlatformStorageConfig,
  GoogleDriveDriver,
} from '@nx-platform-application/platform-infrastructure-storage';

// --- Conditional Mock Providers ---
const authProviders = [{ provide: IAuthService, useExisting: AuthService }];

const chatProvider = environment.useMocks
  ? { provide: ChatService, useClass: MockChatService }
  : [];

const contactsProvider = environment.useMocks
  ? { provide: ContactsStorageService, useClass: MockContactsStorageService }
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
    ];

// ✅ NEW: Cloud Providers (Storage + Config)
const cloudProviders = [
  {
    provide: PlatformStorageConfig,
    useValue: {
      googleClientId: environment.googleClientId,
      // Add googleApiKey here if environment supports it and GAPI needs it
    } as PlatformStorageConfig,
  },
  {
    provide: VaultDrivers, // The "Menu" of drivers
    useClass: GoogleDriveDriver, // The implementation
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
    ...tokenProviders,
    ...cloudProviders, // ✅ Wired

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
