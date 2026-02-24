import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    // LAYER 1: The App Shell (Contains the main toolbar)
    // ✅ Updated import to use the UI library barrel
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

      // --- LAYER 2: DATA SOURCES WORKSPACE ---
      {
        path: 'data-sources',
        loadComponent: () =>
          import('@nx-platform-application/llm-ui').then(
            (m) => m.LlmDataSourcesLayoutComponent,
          ),
        children: [
          // LAYER 3: The Detail Pages
          {
            path: 'new',
            loadComponent: () =>
              import('@nx-platform-application/llm-ui').then(
                (m) => m.LlmDataSourcePageComponent,
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('@nx-platform-application/llm-ui').then(
                (m) => m.LlmDataSourcePageComponent,
              ),
          },
          {
            path: '',
            loadComponent: () =>
              import('@nx-platform-application/llm-ui').then(
                (m) => m.LlmDataSourcesPlaceholderComponent,
              ),
            pathMatch: 'full',
          },
        ],
      },
    ],
  },
];
