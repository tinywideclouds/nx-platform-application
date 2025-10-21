import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(IAuthService);
  const router = inject(Router);
  const isAuthenticated = authService.isAuthenticated();

  console.log(
    `%c[AuthGuard] Checking access to: %c${state.url}`,
    'color: #3498db; font-weight: bold;',
    'color: #3498db;'
  );
  console.log(`%c[AuthGuard] User isAuthenticated: %c${isAuthenticated}`,
    'color: #3498db; font-weight: bold;',
    `color: ${isAuthenticated ? 'green' : 'red'}; font-weight: bold;`
  );


  if (isAuthenticated) {
    console.log(
      '%c[AuthGuard] Decision: Allowing access because user is authenticated.',
      'color: #3498db; font-weight: bold;'
    );
    return true; // Allow access
  }

  console.log(
    '%c[AuthGuard] Decision: Redirecting to /login because user is not authenticated.',
    'color: #3498db; font-weight: bold;'
  );
  router.navigate(['/login']);
  return false; // Block access
};
