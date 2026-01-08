import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { appRoutes } from './app.routes';
import { environment } from './environments/environment';

// --- Logging ---
import {
  LOGGER_CONFIG,
  LogLevel,
} from '@nx-platform-application/console-logger';

// --- Contacts Storage ---
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';

// --- Infrastructure: Cloud Drivers ---
// ✅ NEW: Use the shared Platform Infrastructure
import {
  VaultDrivers,
  PlatformStorageConfig,
  GoogleDriveDriver,
} from '@nx-platform-application/platform-infrastructure-storage';

// --- Cloud Configuration ---
const cloudProviders = [
  {
    provide: PlatformStorageConfig,
    useValue: {
      googleClientId: environment.googleClientId,
    } as PlatformStorageConfig,
  },
  {
    provide: VaultDrivers,
    // Note: If you need a Mock Driver for 'useMocks', create a MockVaultDriver class
    // that implements VaultProvider and swap it here.
    // For now, we wire the real driver or an empty array if mocks are strict.
    useClass: environment.useMocks
      ? class MockVaultDriver {}
      : GoogleDriveDriver,
    multi: true,
  },
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideAnimations(),
    provideHttpClient(), // Required for GoogleDriveDriver

    // 1. Logger Config
    {
      provide: LOGGER_CONFIG,
      useValue: { level: isDevMode() ? LogLevel.DEBUG : LogLevel.INFO },
    },

    // 2. Contacts Storage
    ContactsStorageService,

    // 3. Cloud Infrastructure (Replacing old CONTACTS_CLOUD_CONFIG)
    ...cloudProviders,
  ],
};
