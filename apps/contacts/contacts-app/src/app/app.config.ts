import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  isDevMode,
  APP_INITIALIZER,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { APP_ROUTES } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // CHANGE: This enables true zoneless mode
    provideZonelessChangeDetection(),

    provideRouter(APP_ROUTES),
  ],
};