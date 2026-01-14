import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    // Load the "Smart Shell" from the UI library
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactsViewerComponent,
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactsSettingsPageComponent,
      ),
  },
];
