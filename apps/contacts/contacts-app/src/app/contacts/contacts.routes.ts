// apps/contacts-app/src/app/contacts/contacts.routes.ts

import { Routes } from '@angular/router';

export const CONTACTS_ROUTES: Routes = [
  {
    path: '', // This is now the '/contacts' route
    // The main list view
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactsPageComponent
      ),
  },
  {
    path: 'new', // This is now '/contacts/new'
    // The "Add" page
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactEditPageComponent
      ),
  },
  {
    path: 'edit/:id', // This is now '/contacts/edit/:id'
    // The "Edit" page
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactEditPageComponent
      ),
  },
  // You can add more contact-specific routes here,
  // like 'groups', 'favorites', etc.
];