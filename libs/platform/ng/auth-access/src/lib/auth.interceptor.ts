// libs/platform/ng/auth-data-access/src/lib/auth.interceptor.ts

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { IAuthService } from './auth.service';
import { AUTH_API_URL } from './auth-data.config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(IAuthService);
  const authApiUrl = inject(AUTH_API_URL);

  // Helper to clone request with current token
  const addToken = (request: typeof req) => {
    const token = authService.getJwtToken();
    if (token) {
      return request.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
    }
    return request;
  };

  let authReq = req;

  // 1. Handle Auth API requests (Session/Login)
  if (req.url.startsWith(authApiUrl)) {
    authReq = req.clone({ withCredentials: true });
    // Pass through without retry logic to avoid infinite loops on /status 401s
    return next(authReq);
  }

  // 2. Handle Service requests (Keys/Messages)
  authReq = addToken(req);

  return next(authReq).pipe(
    catchError((error) => {
      // 3. Intercept 401s
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // 4. Attempt Silent Refresh
        return authService.checkAuthStatus().pipe(
          switchMap((status) => {
            if (status?.token) {
              // 5. Refresh Successful: Retry original request with new token
              return next(addToken(req));
            }
            // 6. Refresh Failed: Propagate error (AuthGuard will likely catch this later)
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
