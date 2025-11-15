// apps/messenger/messenger-app/src/app/app.routes.ts
import { Routes } from '@angular/router';

export const app_routes: Routes = [
  {
    path: 'messenger',
    loadChildren: () =>
      import('./messenger/messenger.routes').then((m) => m.MESSENGER_ROUTES),
  },
  {
    path: '',
    redirectTo: 'messenger',
    pathMatch: 'full',
  },
];