import { Route } from '@angular/router';

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
                (m) => m.LlmChatShellComponent,
              ),
          },
          {
            path: '',
            loadComponent: () =>
              import('@nx-platform-application/llm-ui').then(
                (m) => m.LlmChatShellComponent,
              ),
          },
        ],
      },

      // --- LAYER 2: KNOWLEDGE HUB (Data Sources & Blueprints) ---
      {
        path: 'data-sources',
        loadComponent: () =>
          import('@nx-platform-application/data-sources-ui').then(
            (m) => m.DataSourcesLayoutComponent,
          ),
        children: [
          {
            path: '',
            redirectTo: 'repos',
            pathMatch: 'full',
          },

          // LAYER 3a: Repositories (Raw Data)
          {
            path: 'repos',
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

          // LAYER 3b: Context Groups (Blueprints)
          {
            path: 'groups',
            children: [
              {
                path: ':id',
                loadComponent: () =>
                  import('@nx-platform-application/data-sources-ui').then(
                    (m) => m.DataGroupPageComponent,
                  ),
              },
              {
                path: '',
                loadComponent: () =>
                  import('@nx-platform-application/data-sources-ui').then(
                    (m) => m.DataGroupPageComponent,
                  ),
                pathMatch: 'full',
              },
            ],
          },
        ],
      },
    ],
  },
];
