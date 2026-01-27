import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  isDevMode,
  APP_INITIALIZER,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { appRoutes } from './app.routes';
import { environment } from './environments/environment';
import {
  LOGGER_CONFIG,
  LogLevel,
} from '@nx-platform-application/platform-tools-console-logger';
import { ContactsStorageService } from '@nx-platform-application/contacts-infrastructure-storage';
import {
  VaultDrivers,
  PlatformStorageConfig,
  GoogleDriveDriver,
} from '@nx-platform-application/platform-infrastructure-storage';

// API Tokens (The Abstract Contracts)
import {
  DirectoryQueryApi,
  DirectoryMutationApi,
} from '@nx-platform-application/directory-api';

// The Concrete Implementation
import { DirectoryService } from '@nx-platform-application/directory-service';

// The Mock Orchestrator
import { ContactsScenarioService } from '@nx-platform-application/contacts-app-mocking';

export function initializeScenario(scenarioService: ContactsScenarioService) {
  return () =>
    environment.useMocks ? scenarioService.initialize() : Promise.resolve();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideAnimations(),
    provideHttpClient(),

    {
      provide: LOGGER_CONFIG,
      useValue: { level: isDevMode() ? LogLevel.DEBUG : LogLevel.INFO },
    },

    // --- INFRASTRUCTURE ---
    ContactsStorageService,

    // ✅ BINDING THE DIRECTORY APIs (The Fix)
    // "When the Bridge asks for the API, give it the Service."
    { provide: DirectoryQueryApi, useExisting: DirectoryService },
    { provide: DirectoryMutationApi, useExisting: DirectoryService },

    // --- INITIALIZATION ---
    {
      provide: APP_INITIALIZER,
      useFactory: initializeScenario,
      deps: [ContactsScenarioService],
      multi: true,
    },

    {
      provide: PlatformStorageConfig,
      useValue: {
        googleClientId: environment.googleClientId,
      } as PlatformStorageConfig,
    },
    {
      provide: VaultDrivers,
      useClass: GoogleDriveDriver,
      multi: true,
    },
  ],
};
