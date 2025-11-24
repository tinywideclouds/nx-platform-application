import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withEnabledBlockingInitialNavigation } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';

export const appConfig: ApplicationConfig = {
  providers: [
    // 1. ENABLE ZONELESS
    provideZonelessChangeDetection(),
    
    // 2. ROUTER CONFIG
    provideRouter(appRoutes, 
      withEnabledBlockingInitialNavigation(),
      withComponentInputBinding() // Helpful for binding URL params to Inputs
    ),

    // 3. MATERIAL ANIMATIONS
    provideAnimations()
  ],
};