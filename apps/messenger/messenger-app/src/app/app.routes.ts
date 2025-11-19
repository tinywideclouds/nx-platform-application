// apps/messenger/messenger-app/src/app/app.routes.ts

import { Routes } from '@angular/router';
import {
  MESSENGER_ROUTES, // <-- Import from lib
} from '@nx-platform-application/messenger-ui';

import {
  LoginSuccessComponent,
  LoginComponent as RealLoginComponent
} from '@nx-platform-application/platform-auth-ui';

import { authGuard } from './auth/auth.guard';
import { nonAuthGuard } from './auth/non-auth.guard';
import { environment } from './environments/environment';
import { MockLoginComponent } from '@nx-platform-application/platform-auth-ui/mocks';

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
    path: '', // Main app route
    // We remove the explicit component here because MESSENGER_ROUTES 
    // already defines the top-level component at its path: ''
    canActivate: [authGuard],
    children: MESSENGER_ROUTES // <-- Delegate to Lib Routes
  },
  // Fallback route
  { path: '**', redirectTo: '' },
];