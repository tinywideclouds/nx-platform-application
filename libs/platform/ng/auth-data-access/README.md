# 📚 Library: platform-auth-data-access

## 🎯 Purpose

This library is the central source of truth for user authentication and session management. It provides the core `AuthService`, an HTTP interceptor for automatically attaching auth tokens, and helper functions for simple setup.

The service is signal-based, zoneless-ready, and designed to work with an `APP_INITIALIZER` to ensure the user's session is checked *before* the application renders.

## 📦 Public API

This library exports the following key members from its primary (`index.ts`) and secondary (`testing.ts`) entry points.

### Primary API (`index.ts`)

  * **`IAuthService` / `AuthService`:** The abstract class and concrete implementation for managing auth. It holds the user's state (`currentUser`, `isAuthenticated`) and handles all auth-related API calls [cite: auth.service.ts].
  * **`authInterceptor`:** An `HttpInterceptorFn` that automatically:
    1.  Attaches the `Authorization: Bearer <token>` header to all API calls.
    2.  Sets `withCredentials: true` for requests to the auth service itself [cite: auth.interceptor.ts].
  * **`provideAuth`:** A helper function that provides `HttpClient` along with the `authInterceptor` [cite: auth.providers.ts].
  * **`AUTH_API_URL`:** An `InjectionToken<string>` used to provide the base URL for the authentication service, allowing the interceptor to differentiate auth requests from other API requests [cite: auth-data.config.ts].

### Testing API (`testing.ts`)

  * **`MockAuthService`:** A complete, drop-in mock implementation of `AuthService` for use in unit and component tests. It provides methods like `mockCheckAuthStatusSuccess()` and `setAuthenticated()` to control the auth state from within your tests [cite: mock-auth.service.ts, testing.ts].

-----

## 🏛️ Architectural Patterns & Usage

This library is designed to be set up once in your main `app.config.ts`.

### 1\. `AuthService` & `APP_INITIALIZER`

The `AuthService` is built around its `sessionLoaded$` observable [cite: auth.service.ts]. This stream performs the initial `checkAuthStatus()` API call and is designed to be used with an `APP_INITIALIZER`. This pattern blocks the application from loading until the first auth check is complete, which prevents UI flickers or race conditions.

### 2\. Signal-Based State

The service exposes its state as signals for easy, reactive consumption throughout your application:

  * `currentUser: Signal<User | null>`
  * `isAuthenticated: Signal<boolean>`

### 3\. `authInterceptor`

The interceptor uses the `AUTH_API_URL` token to determine how to handle a request.

  * **If `req.url` starts with `AUTH_API_URL`:** It sets `withCredentials: true` and does *not* add the Bearer token.
  * **For all other requests:** It calls `authService.getJwtToken()` and attaches the `Authorization` header [cite: auth.interceptor.ts].

## 🚀 Example Usage

Here is how to configure this library in a standalone `app.config.ts`:

```typescript
// in apps/my-app/src/app/app.config.ts

import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  AUTH_API_URL,
  IAuthService,
  AuthService,
  provideAuth,
} from '@nx-platform-application/platform-auth-data-access';

// 1. Factory for the APP_INITIALIZER
export function initializeAuthFactory(
  authService: IAuthService
): () => Promise<unknown> {
  return () => firstValueFrom(authService.sessionLoaded$);
}

export const appConfig: ApplicationConfig = {
  providers: [
    // 2. Provide the helper which includes the interceptor
    provideAuth(),

    // 3. Provide the real AuthService
    { provide: IAuthService, useClass: AuthService },

    // 4. Provide the InjectionToken for the interceptor
    { provide: AUTH_API_URL, useValue: '/api/auth' },

    // 5. Add the APP_INITIALIZER
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuthFactory,
      deps: [IAuthService],
      multi: true,
    },
  ],
};
```

## 🧪 Testing Example

To use the mock in a component's test, import it from the `/testing` entry point.

```typescript
// in my.component.spec.ts

import { TestBed } from '@angular/core/testing';
import {
  IAuthService,
  MockAuthService,
} from '@nx-platform-application/platform-auth-data-access/testing';

describe('MyComponent', () => {
  let mockAuth: MockAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        // 1. Provide the MockAuthService
        { provide: IAuthService, useClass: MockAuthService },
      ],
    }).compileComponents();

    // 2. Inject the mock (as the concrete class)
    mockAuth = TestBed.inject(IAuthService) as MockAuthService;
  });

  it('should show user info when logged in', () => {
    // 3. Control the auth state
    mockAuth.setAuthenticated({ id: '123', alias: 'Test', email: 'test@user.com' });

    // ... run your test
  });
});
```