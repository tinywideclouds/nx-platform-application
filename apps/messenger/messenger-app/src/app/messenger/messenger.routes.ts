// apps/messenger/messenger-app/src/app/messenger.routes.ts
import { Routes } from '@angular/router';

export const MESSENGER_ROUTES: Routes = [
  {
    path: '',
    // --- THIS IS THE CHANGE ---
    // Load our new "smart" page component
    loadComponent: () =>
      import('@nx-platform-application/messenger-ui').then(
        (m) => m.MessengerHomePageComponent
      ),
  },
  // We will add the route for the chat window here later
  // e.g., { path: 'chat/:id', loadComponent: ... }
];