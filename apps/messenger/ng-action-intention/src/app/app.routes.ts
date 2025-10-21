import { Routes } from '@angular/router';
// Import the components from the auth-ui library [cite: 21]
import {
  LoginSuccessComponent,
  LoginComponent as RealLoginComponent
} from '@nx-platform-application/platform-auth-ui';
// Import the new guard
import { authGuard } from './auth/auth.guard';
import { environment } from '../environments/environment';
import { MockLoginComponent } from "./auth/mocks/mock-login.component";
import {nonAuthGuard} from "./auth/mocks/non-auth.guard";

// Conditionally choose which component to use for the '/login' path
const loginComponent = environment.useMocks ? MockLoginComponent : RealLoginComponent;

export const appRoutes: Routes = [
  {
    path: 'login',
    component: loginComponent,
    canActivate: [nonAuthGuard], // <-- APPLY THE GUARD HERE
  },
  {
    path: 'login-success',
    component: LoginSuccessComponent, // [cite: 24]
  },
  {
    path: 'messaging',
    canActivate: [authGuard], // Apply the guard to the main route [cite: 32]
    // Example of lazy-loading the main feature
    loadChildren: () =>
      import('./messaging/messaging.routes').then((r) => r.messagingRoutes),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'messaging', // Default route redirects to the protected area
  },
];
