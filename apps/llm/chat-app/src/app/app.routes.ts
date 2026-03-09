import { Route } from '@angular/router';

// A temporary placeholder until we build the real cache UI next
import { Component } from '@angular/core';
@Component({
  standalone: true,
  template: `<div class="p-8 text-xl text-gray-500 font-medium">
    Gemini Caches UI goes here
  </div>`,
})
export class DummyCachesComponent {}

export const appRoutes: Route[] = [
  {
    path: '',
    // LAYER 1: The App Shell (Contains the main toolbar)
    loadComponent: () =>
      import('@nx-platform-application/llm-ui').then(
        (m) => m.LlmHomePageComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'chat',
      },

      // --- LAYER 2: CHAT WORKSPACE ---
      {
        path: 'chat',
        children: [
          {
            path: ':sessionId',
            loadComponent: () =>
              import('@nx-platform-application/llm-ui').then(
                (m) => m.LlmChatViewerComponent,
              ),
          },
          {
            path: '',
            loadComponent: () =>
              import('@nx-platform-application/llm-ui').then(
                (m) => m.LlmChatViewerComponent,
              ),
          },
        ],
      },

      // --- LAYER 2: KNOWLEDGE HUB (The New Wrapper) ---
      {
        path: 'data-sources',
        loadComponent: () =>
          import('@nx-platform-application/llm-ui').then(
            (m) => m.DataSourceWrapperComponent,
          ),
        children: [
          {
            path: '',
            redirectTo: 'repos',
            pathMatch: 'full',
          },

          // LAYER 3a: Pure Data Sources (Components from the external library)
          {
            path: 'repos',
            loadComponent: () =>
              import('@nx-platform-application/data-sources-ui').then(
                (m) => m.DataSourcesLayoutComponent,
              ),
            children: [
              {
                path: 'new',
                loadComponent: () =>
                  import('@nx-platform-application/data-sources-ui').then(
                    (m) => m.DataSourcePageComponent,
                  ),
              },
              {
                path: ':id',
                loadComponent: () =>
                  import('@nx-platform-application/data-sources-ui').then(
                    (m) => m.DataSourcePageComponent,
                  ),
              },
              {
                path: '',
                loadComponent: () =>
                  import('@nx-platform-application/data-sources-ui').then(
                    (m) => m.DataSourcesPlaceholderComponent,
                  ),
                pathMatch: 'full',
              },
            ],
          },

          // LAYER 3b: Compiled Caches (Owned by LLM UI)
          {
            path: 'caches',
            loadComponent: () => DummyCachesComponent,
          },
        ],
      },
    ],
  },
];
