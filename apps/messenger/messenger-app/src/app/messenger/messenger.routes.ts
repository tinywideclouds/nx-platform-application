// apps/messenger/messenger-app/src/app/messenger.routes.ts
import { Routes } from '@angular/router';

export const MESSENGER_ROUTES: Routes = [
  // We'll add our messenger-feature component here
  // For now, a placeholder:
  {
    path: '',
    loadComponent: () =>
      import('./components/messenger-home/messenger-home.component').then((m) => m.MessengerHomeComponent),
  },
];