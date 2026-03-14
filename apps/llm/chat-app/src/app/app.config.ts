import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { appRoutes } from './app.routes';

import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { GeminiDataService } from '@nx-platform-application/llm-infrastructure-gemini-access';

import {
  LlmWeightCalculator,
  SimpleCharWeightCalculator,
} from '@nx-platform-application/llm-tools-weighting';

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

    // 2. Weight Calculator Implementation
    {
      provide: LlmWeightCalculator,
      useClass: SimpleCharWeightCalculator,
    },
  ],
};
