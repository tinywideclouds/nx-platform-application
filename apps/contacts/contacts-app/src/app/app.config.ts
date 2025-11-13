// apps/contacts-app/src/app/app.config.ts

import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { APP_ROUTES } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Enable zoneless change detection
    provideZoneChangeDetection({ eventCoalescing: true }),

    // Provide the application routes
    provideRouter(APP_ROUTES),
  ],
};