import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { appRoutes } from './app.routes';

import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { GeminiDataService } from '@nx-platform-application/llm-infrastructure-gemini-access';
import { LlmScenarioService } from '@nx-platform-application/llm-app-mocking';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
    provideAnimationsAsync(),

    // 1. Real Network Client
    {
      provide: LLM_NETWORK_CLIENT,
      useClass: GeminiDataService,
    },

    // 2. Database Seeding (Scenario Mocking)
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: (scenarios: LlmScenarioService) => () =>
        scenarios.initialize(),
      deps: [LlmScenarioService],
    },
  ],
};
