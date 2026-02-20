import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'chat',
  },
  {
    path: 'chat',
    children: [
      {
        // 1. Specific Session: /chat/urn:llm:session:123
        path: ':sessionId',
        loadComponent: () =>
          import('@nx-platform-application/llm-ui').then(
            (m) => m.LlmChatViewerComponent,
          ),
      },
      {
        // 2. Default/Root: /chat
        // Loads the same component, but 'sessionId' input will be undefined.
        // The component will handle the "Find Recent or Create New" logic.
        path: '',
        loadComponent: () =>
          import('@nx-platform-application/llm-ui').then(
            (m) => m.LlmChatViewerComponent,
          ),
      },
    ],
  },
];
