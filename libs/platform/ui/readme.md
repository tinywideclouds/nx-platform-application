# 🎨 Platform UI Layer

**Scope:** `libs/platform/ui/*`
**Classification:** Presentational / Design System

## 🧠 Architectural Role

The **UI Layer** contains "Dumb" (Presentational) Components.
These libraries define the visual language of the application. They are **purely reactive**:

1.  **Inputs In:** Data arrives via Signals/Inputs.
2.  **Outputs Out:** User intent leaves via Events/Outputs.
3.  **No Logic:** They do _not_ inject Domain Services, make API calls, or manage global state (exceptions made for self-contained widgets like Auth Login which drive specific infrastructure flows).

## 🛡️ The UI Contract

1.  **Zoneless Ready:** All components use `ChangeDetectionStrategy.OnPush` and Signals.
2.  **Theme Agnostic:** Components should use CSS variables or Tailwind utility classes to remain compatible with light/dark modes.
3.  **Reusable:** Components here must be generic enough to be used in _any_ feature app (Messenger, Contacts, Settings).

## 📂 Component Catalog

### 🔐 Auth & Identity

| Library     | Package                 | Key Components                                                                             |
| :---------- | :---------------------- | :----------------------------------------------------------------------------------------- |
| **Auth UI** | `@.../platform-ui-auth` | `<aui-login>`: The standard login card.<br>`<aui-login-success>`: OAuth2 callback handler. |

### ☁️ Integrations

| Library        | Package                     | Key Components                                                                                      |
| :------------- | :-------------------------- | :-------------------------------------------------------------------------------------------------- |
| **Storage UI** | `@.../platform-ui-storage`  | `<platform-storage-provider-menu>`: A button list for connecting Cloud Providers (Google, Dropbox). |
| **QR Codes**   | `@.../platform-ui-qr-codes` | `<platform-qr-scanner>`: A reactive camera viewfinder that emits detected QR strings.               |

### 📐 Layouts & Structure

| Library     | Package                    | Key Components                                                                                                                                        |
| :---------- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layouts** | `@.../platform-ui-layouts` | `<platform-master-detail-layout>`: A responsive shell that switches between Split-View (Desktop) and Stack-View (Mobile) using CSS Container Queries. |

### 🧰 General Toolkit

| Library     | Package                    | Key Components                                                                                                                                                               |
| :---------- | :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Toolkit** | `@.../platform-ui-toolkit` | `<platform-feature-placeholder>`: Empty states / Error displays.<br>`<platform-list-filter>`: Expanding search bar.<br>`[appAutoScroll]`: Chat log auto-scrolling directive. |

## 🏗️ Usage Guidelines

### 1. Composition over Inheritance

Do not extend these components. Use **Content Projection** (Slots) to insert feature-specific content.

```html
<platform-master-detail-layout>
  <div sidebar><messenger-list></messenger-list></div>
  <div main><messenger-chat></messenger-chat></div>
</platform-master-detail-layout>
```

### 2. Smart vs. Dumb

These components are **Dumb**. They should be wrapped by a **Smart** component (in a Feature library) that connects them to the Store/Services.

- ❌ **Don't:** Inject `AuthService` into `<platform-user-card>`.
- ✅ **Do:** Pass `[user]="authService.currentUser()"` into `<platform-user-card>`.
