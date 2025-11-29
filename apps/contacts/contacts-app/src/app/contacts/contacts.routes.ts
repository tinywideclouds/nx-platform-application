// apps/contacts-app/src/app/contacts/contacts.routes.ts

import { Routes } from '@angular/router';

export const CONTACTS_ROUTES: Routes = [
  {
    path: '', // '/contacts'
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactsViewerComponent
      ),
  },
  {
    path: 'new', // '/contacts/new'
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactPageComponent
      ),
  },
  {
    path: 'edit/:id', // '/contacts/edit/:id'
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactPageComponent
      ),
  },
  {
    path: 'group-new', // '/contacts/group-new'
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactGroupPageComponent
      ),
  },
  {
    path: 'group-edit/:id', // '/contacts/group-edit/:id'
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactGroupPageComponent
      ),
  },
  // NEW: Settings Route
  {
    path: 'settings', // '/contacts/settings'
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactsSettingsPageComponent
      ),
  },
];
