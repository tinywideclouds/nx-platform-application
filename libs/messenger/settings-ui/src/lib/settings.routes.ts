import { Routes } from '@angular/router';
import { SettingsShellComponent } from './settings-shell/settings-shell.component';
import { DeviceLinkPageComponent } from './device-link-page/device-link-page.component';
import { KeySettingsPageComponent } from './key-settings-page/key-settings-page.component';
import { DataSettingsPageComponent } from './data-settings-page/data-settings-page.component';

export const settingsRoutes: Routes = [
  {
    path: '',
    component: SettingsShellComponent,
    children: [
      {
        path: 'identity',
        loadComponent: () =>
          import(
            './identity-settings-page/identity-settings-page.component'
          ).then((m) => m.IdentitySettingsPageComponent),
        data: { title: 'Identity' },
      },
      {
        path: 'data',
        component: DataSettingsPageComponent,
        data: { title: 'Data & Storage' },
      },
      {
        path: 'keys', // "Keys & Routing"
        component: KeySettingsPageComponent,
        data: { title: 'Keys & Routing' },
      },
      // --- Functional Routes ---
      {
        path: 'link-device',
        component: DeviceLinkPageComponent,
        data: { title: 'Link New Device' },
      },
    ],
  },
];
