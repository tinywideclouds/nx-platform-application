import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';
import { map } from 'rxjs';

export const nonAuthGuard: CanActivateFn = () => {
  const authService = inject(IAuthService);
  const router = inject(Router);

  return authService.sessionLoaded$.pipe(
    map(() => {
      if (authService.isAuthenticated()) {
        router.navigate(['/']);
        return false;
      }
      return true;
    })
  );
};
