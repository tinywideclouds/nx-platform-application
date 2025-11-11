import { HttpInterceptorFn, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { AUTH_API_URL } from './auth-data.config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const authApiUrl = inject(AUTH_API_URL); // Inject the token
  let authReq = req;

  // Check if the request is going to the auth service itself
  if (req.url.startsWith(authApiUrl)) {
    authReq = req.clone({
      withCredentials: true,
    });
  } else {
    // This is for all other API calls (like to key-service)
    const token = authService.getJwtToken(); // Use the correct method
    if (token) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
  }
  return next(authReq);
};