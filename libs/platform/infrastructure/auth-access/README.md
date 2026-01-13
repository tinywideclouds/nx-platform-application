# 🛡️ Platform Auth Access

**Layer:** Infrastructure
**Scope:** Platform (Shared)
**Package:** `@nx-platform-application/platform-infrastructure-auth-access`

## 🧠 Purpose

This library is the central infrastructure for user authentication and session management. It manages the "Access" layer—specifically handling JWTs, HTTP Interceptors, and the REST API communication with the Identity Provider.

It is **Signal-based** and **Zoneless-ready**, designed to work with an `APP_INITIALIZER` to ensure the user's session is validated _before_ the application renders.

## 📦 Public API

### Primary API (`index.ts`)

- **`IAuthService` / `AuthService`:** The concrete implementation for managing auth state. It holds the user's reactive state (`currentUser`, `isAuthenticated`) and handles all auth-related API calls.
- **`authInterceptor`:** An `HttpInterceptorFn` that automatically:
  1.  Attaches the `Authorization: Bearer <token>` header to all API calls.
  2.  Sets `withCredentials: true` for requests to the auth service itself.
- **`provideAuth`:** A helper function that provides `HttpClient` wired up with the `authInterceptor`.
- **`AUTH_API_URL`:** An `InjectionToken<string>` used to define the base URL for the authentication service.

### Testing API (`testing.ts`)

- **`MockAuthService`:** A complete, drop-in mock implementation of `AuthService` for use in unit and component tests. It allows you to simulate "Logged In" or "Logged Out" states without mocking HTTP calls.

---

## 🏗️ Architectural Usage

This library is designed to be configured once in your application's root (e.g., `app.config.ts`).

### 1. `AuthService` & `APP_INITIALIZER`

The `AuthService` exposes a `sessionLoaded$` observable. This stream performs the initial `checkAuthStatus()` API call. You should use this in an `APP_INITIALIZER` to block the app bootstrap until Auth is resolved.

### 2. Signal-Based State

The service exposes its state as Angular Signals for reactive consumption:

- `currentUser: Signal<User | null>`
- `isAuthenticated: Signal<boolean>`

### 3. The Interceptor Strategy

The interceptor uses the `AUTH_API_URL` token to differentiate requests:

- **Identity Requests:** (Start with `AUTH_API_URL`) -> Sets `withCredentials: true`, NO Bearer token.
- **Data Requests:** (Everything else) -> Attaches `Authorization: Bearer <token>`.

## 💻 Configuration Example

```typescript
// apps/messenger/src/app/app.config.ts

import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AUTH_API_URL, IAuthService, AuthService, provideAuth } from '@nx-platform-application/platform-infrastructure-auth-access';

// 1. Factory for the APP_INITIALIZER
export function initializeAuthFactory(authService: IAuthService): () => Promise<unknown> {
  return () => firstValueFrom(authService.sessionLoaded$);
}

export const appConfig: ApplicationConfig = {
  providers: [
    // 2. Provide HttpClient + Interceptor
    provideAuth(),

    // 3. Provide the Service
    { provide: IAuthService, useClass: AuthService },

    // 4. Configure the API Endpoint
    { provide: AUTH_API_URL, useValue: '/api/auth' },

    // 5. Block Bootstrap until Auth Check completes
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

To use the mock in a component test:

```typescript
import { TestBed } from '@angular/core/testing';
// Note the /testing import path
import { IAuthService, MockAuthService } from '@nx-platform-application/platform-infrastructure-auth-access/testing';

describe('UserProfileComponent', () => {
  let mockAuth: MockAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        // Swap the real service for the mock
        { provide: IAuthService, useClass: MockAuthService },
      ],
    }).compileComponents();

    mockAuth = TestBed.inject(IAuthService) as MockAuthService;
  });

  it('should display user alias', () => {
    // Simulate a logged-in user
    mockAuth.setAuthenticated({ id: 'urn:user:123', alias: 'Test User', email: 'test@user.com' });

    // Assert UI...
  });
});
```
