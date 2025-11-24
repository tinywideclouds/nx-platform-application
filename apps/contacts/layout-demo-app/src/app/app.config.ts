import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    // FIX: Use provideZonelessChangeDetection instead of provideZoneChangeDetection
    provideZonelessChangeDetection(),
    provideRouter([], withEnabledBlockingInitialNavigation()),
  ],
};