// apps/messenger/messenger-app/src/app/app.routes.ts

import { Routes } from '@angular/router';
import { messengerRoutes } from '@nx-platform-application/messenger-ui';

import {
  LoginSuccessComponent,
  LoginComponent as RealLoginComponent,
} from '@nx-platform-application/platform-ui-auth';

import { authGuard } from './auth/auth.guard';
import { nonAuthGuard } from './auth/non-auth.guard';
import { environment } from './environments/environment';

const loginComponent = RealLoginComponent;

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
    pathMatch: 'full',
  },
  // 2. Mount the library under the 'messenger' path
  {
    path: 'messenger',
    canActivate: [authGuard],
    children: messengerRoutes,
  },
  // === FIX ENDS HERE ===

  { path: '**', redirectTo: 'messenger' },
];
