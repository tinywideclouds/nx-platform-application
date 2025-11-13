// apps/contacts-app/src/app/app.routes.ts

import { Routes } from '@angular/router';
import { ContactsPageComponent } from '@nx-platform-application/contacts-ui';
import { AllContactsPlaceholderComponent } from './contacts/contacts.component';

export const APP_ROUTES: Routes = [
  {
    path: 'messenger',
    component: ContactsPageComponent, // Our existing "smart" component
  },
  {
    path: 'all-contacts',
    component: AllContactsPlaceholderComponent, // The new placeholder
  },
  {
    path: '',
    redirectTo: 'messenger', // Default to the messenger view
    pathMatch: 'full',
  },
];