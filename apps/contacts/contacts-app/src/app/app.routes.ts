// apps/contacts-app/src/app/app.routes.ts

import { Routes } from '@angular/router';
// This import for the placeholder is still correct [cite: contacts.component.ts]
import { AllContactsPlaceholderComponent } from './contacts/contacts.component';

export const APP_ROUTES: Routes = [
  {
    path: 'contacts',
    // 1. Use loadChildren to import the feature routes file
    loadChildren: () =>
      import('./contacts/contacts.routes').then((m) => m.CONTACTS_ROUTES),
  },
  {
    path: 'all-contacts',
    component: AllContactsPlaceholderComponent,
  },
  {
    path: '',
    redirectTo: 'contacts', // Default to the contacts feature
    pathMatch: 'full',
  },
];