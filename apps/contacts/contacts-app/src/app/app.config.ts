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

// --- Cloud Access ---
import {
  CONTACTS_CLOUD_CONFIG,
  CLOUD_PROVIDERS,
  GoogleDriveService,
  MockCloudProvider,
} from '@nx-platform-application/contacts-cloud-access';

// --- Mock Providers (if needed for storage/auth in harness) ---
// Assuming you have a mock for ContactsStorageService similar to messenger-app,
// otherwise use the real one for the 'real' harness mode.

const cloudConfigProvider = {
  provide: CONTACTS_CLOUD_CONFIG,
  useValue: { googleClientId: environment.googleClientId },
};

// Choose Cloud Provider based on environment
const cloudProviders = environment.useMocks
  ? [{ provide: CLOUD_PROVIDERS, useClass: MockCloudProvider, multi: true }]
  : [{ provide: CLOUD_PROVIDERS, useClass: GoogleDriveService, multi: true }];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideAnimations(),
    provideHttpClient(), // Required for GoogleDriveService fetch/REST calls

    // 1. Logger Config
    {
      provide: LOGGER_CONFIG,
      useValue: { level: isDevMode() ? LogLevel.DEBUG : LogLevel.INFO },
    },

    // 2. Contacts Storage (Real or Mock could go here depending on harness needs)
    ContactsStorageService,

    // 3. Cloud Access Configuration
    cloudConfigProvider,
    ...cloudProviders,
  ],
};
