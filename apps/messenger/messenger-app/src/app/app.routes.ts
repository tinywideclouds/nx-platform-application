import { Routes } from '@angular/router';
import {
  MessengerHomePageComponent,
  ChatWindowComponent,
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
    component: MessengerHomePageComponent,
    canActivate: [authGuard], // Protect this route
    children: [
      {
        path: 'chat/:id',
        component: ChatWindowComponent,
        // No extra guard needed, parent is already protected
      },
    ],
  },
  // Fallback route
  { path: '**', redirectTo: '' },
];