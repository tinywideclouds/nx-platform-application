import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { map } from 'rxjs';

export const nonAuthGuard: CanActivateFn = () => {
  const authService = inject(IAuthService);
  const router = inject(Router);

  return authService.sessionLoaded$.pipe(
    map(() => {
      if (authService.isAuthenticated()) {
        router.navigate(['/messaging']);
        return false;
      }
      return true;
    }),
  );
};
