import { Routes } from '@angular/router';
import { SettingsShellComponent } from './settings-shell/settings-shell.component';

export const settingsRoutes: Routes = [
  {
    path: '',
    component: SettingsShellComponent,
    children: [
      {
        path: '',
        redirectTo: 'identity',
        pathMatch: 'full',
      },
      {
        path: 'identity',
        loadComponent: () =>
          import(
            './identity-settings-page/identity-settings-page.component'
          ).then((m) => m.IdentitySettingsPageComponent),
      },
      {
        path: 'keys',
        loadComponent: () =>
          import('./key-settings-page/key-settings-page.component').then(
            (m) => m.KeySettingsPageComponent
          ),
      },
      {
        path: 'routing',
        loadComponent: () =>
          import(
            './routing-settings-page/routing-settings-page.component'
          ).then((m) => m.RoutingSettingsPageComponent),
      },
      // NEW: Contacts & Security Page
      {
        path: 'contacts',
        loadComponent: () =>
          import('@nx-platform-application/contacts-ui').then(
            (m) => m.ContactsSettingsPageComponent
          ),
      },
    ],
  },
];
