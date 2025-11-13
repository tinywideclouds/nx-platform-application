import { Routes } from '@angular/router';
import { AllContactsPlaceholderComponent } from './contacts/contacts.component';

export const APP_ROUTES: Routes = [
  {
    path: 'messenger',
    // LAZY LOAD: Isolates the feature. If the lib crashes, the app shell still loads.
    loadComponent: () => 
      import('@nx-platform-application/contacts-ui').then(m => m.ContactsPageComponent),
  },
  {
    path: 'all-contacts',
    component: AllContactsPlaceholderComponent,
  },
  {
    path: '',
    redirectTo: 'messenger',
    pathMatch: 'full',
  },
];