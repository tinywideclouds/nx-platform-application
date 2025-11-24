// apps/messenger/messenger-app/src/app/app.routes.ts

import { Routes } from '@angular/router';
import {
  MESSENGER_ROUTES,
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
  
  // === FIX STARTS HERE ===
  // 1. Redirect root to /messenger
  {
    path: '',
    redirectTo: 'messenger',
    pathMatch: 'full'
  },
  // 2. Mount the library under the 'messenger' path
  {
    path: 'messenger', 
    canActivate: [authGuard],
    children: MESSENGER_ROUTES 
  },
  // === FIX ENDS HERE ===

  { path: '**', redirectTo: 'messenger' },
];