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
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import {
  VaultDrivers,
  PlatformStorageConfig,
  GoogleDriveDriver,
} from '@nx-platform-application/platform-infrastructure-storage';

// 1. Import Service
import { ScenarioService } from './services/scenario.service';

// 2. Factory
export function initializeScenario(scenarioService: ScenarioService) {
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

    // 3. Services
    ContactsStorageService,

    // 4. Seeder (The Fix)
    {
      provide: APP_INITIALIZER,
      useFactory: initializeScenario,
      deps: [ScenarioService],
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
