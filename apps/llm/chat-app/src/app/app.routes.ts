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
          // INVERSION: We default to the Consumption pillar now!
          {
            path: '',
            redirectTo: 'sources',
            pathMatch: 'full',
          },

          // --- PILLAR: CONSUMPTION ---

          // LAYER 3a: Sources (Data Streams)
          {
            path: 'sources',
            children: [
              // FIXED: Removed explicit 'new' path. ':id' will catch 'new' and pass it to the component.
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

          // Alias to catch the UI terminology from the sidebar tabs
          {
            path: 'streams',
            redirectTo: 'sources',
            pathMatch: 'full',
          },

          // LAYER 3b: Context Groups (Blueprints)
          {
            path: 'groups',
            children: [
              // FIXED: Removed explicit 'new' path.
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
                    (m) => m.DataSourcesPlaceholderComponent,
                  ),
                pathMatch: 'full',
              },
            ],
          },

          // --- PILLAR: INGESTION ---

          // LAYER 3c: Repositories (Raw Data Lakes)
          {
            path: 'repos',
            children: [
              // FIXED: Removed explicit 'new' path.
              {
                path: ':id',
                loadComponent: () =>
                  import('@nx-platform-application/data-sources-ui').then(
                    (m) => m.GithubIngestionPageComponent,
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
        ],
      },
    ],
  },
];
