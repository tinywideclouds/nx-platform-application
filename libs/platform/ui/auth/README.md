# 🎨 Platform Auth UI

**Layer:** UI
**Scope:** Platform (Shared)
**Package:** `@nx-platform-application/platform-ui-auth`

## 🧠 Purpose

This library provides the standard **Login** and **Auth Callback** screens for the application.
It consumes the `platform-infrastructure-auth-access` layer to drive the UI state.

## 📦 Components

### `LoginComponent` (`<aui-login>`)

A card-based login form that toggles between "Login with Google" and "Logout" based on the current auth state.

- **Inputs:** None (Self-contained via DI).
- **Dependencies:** `IAuthService`, `AUTH_API_URL`.
- **Selectors:** `aui-login`.

### `LoginSuccessComponent` (`<aui-login-success>`)

The landing page for the OAuth2 callback.

1.  Displays a spinner.
2.  Calls `authService.checkAuthStatus()`.
3.  Redirects to `/` on success or `/login` on failure.

- **Routing:** Should be mapped to the `/login/success` route in the application shell.

## 💻 Usage Example

**In your App Router (`app.routes.ts`):**

```typescript
import { Routes } from '@angular/router';
import { LoginComponent, LoginSuccessComponent } from '@nx-platform-application/platform-ui-auth';

export const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'login/success', component: LoginSuccessComponent },
  // ...
];
```

### 🧪 Testing

These components are tested using MockTestingAuthService from the infrastructure layer. Tests verify:

Login: Button URLs are constructed correctly using AUTH_API_URL.

Callback: Router navigation happens only after the auth check completes.
