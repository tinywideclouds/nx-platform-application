import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';

export const nonAuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(IAuthService);
  const router = inject(Router);
  const isAuthenticated = authService.isAuthenticated();

  console.log(
    `%c[NonAuthGuard] Checking access to: %c${state.url}`,
    'color: #ff6e59; font-weight: bold;',
    'color: #ff6e59;'
  );
  console.log(`%c[NonAuthGuard] User isAuthenticated: %c${isAuthenticated}`,
    'color: #ff6e59; font-weight: bold;',
    `color: ${isAuthenticated ? 'green' : 'red'}; font-weight: bold;`
  );

  if (isAuthenticated) {
    console.log(
      '%c[NonAuthGuard] Decision: Redirecting to /messaging because user is already logged in.',
      'color: #ff6e59; font-weight: bold;'
    );
    router.navigate(['/messaging']);
    return false; // Block access to login page
  }

  console.log(
    '%c[NonAuthGuard] Decision: Allowing access because user is not logged in.',
    'color: #ff6e59; font-weight: bold;'
  );
  return true; // Allow access to login page
};
