import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(IAuthService); //
  const token = authService.getJwtToken(); //

  if (token) {
    // Clone the request and add the auth header
    const clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    return next(clonedReq);
  }

  return next(req);
};
