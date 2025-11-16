import { Routes } from '@angular/router';
// Import the components from the auth-ui library [cite: 21]
import {
  LoginSuccessComponent,
  LoginComponent as RealLoginComponent
} from '@nx-platform-application/platform-auth-ui';

// 1. Import the new ContactsComponent
import { ContactsComponent } from '@nx-platform-application/contacts-ui'; //

// Import the new guard
import { authGuard } from './auth/auth.guard'; // [cite: 24]
import { environment } from '../environments/environment';
import { MockLoginComponent } from "./auth/mocks/mock-login.component";
import { nonAuthGuard } from "./auth/non-auth.guard";

// Conditionally choose which component to use for the '/login' path
const loginComponent = environment.useMocks ? MockLoginComponent : RealLoginComponent;

export const appRoutes: Routes = [
  {
    path: 'login',
    component: loginComponent,
    canActivate: [nonAuthGuard], 
  },
  {
    path: 'login-success',
    component: LoginSuccessComponent, 
  },
  {
    path: 'messaging',
    canActivate: [authGuard], // Apply the guard to the main route
    // Example of lazy-loading the main feature
    loadChildren: () =>
      import('./messaging/messaging.routes').then((r) => r.messagingRoutes),
  },

  // 2. Add the new protected route for contacts
  {
    path: 'contacts',
    component: ContactsComponent,
    canActivate: [authGuard] //
  },

  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'messaging', // Default route redirects to the protected area
  },
];
