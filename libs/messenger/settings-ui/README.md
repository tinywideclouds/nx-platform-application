# ⚙️ @nx-platform-application/messenger-settings-ui

This library provides the **Settings & Administration** feature slice for the Messenger application. It is designed as a lazy-loaded module that handles sensitive operations like identity management, key rotation, and device wiping.

## 🏛️ Architecture

The settings feature runs in its own shell (`SettingsShellComponent`) to provide a distinct context from the main chat interface. It is organized into three domain-specific pages:

1.  **Identity:** User profile verification and session management.
2.  **Encryption Keys:** OMEMO/Signal Protocol key management (Fingerprint verification, Key Regeneration).
3.  **Routing:** Network diagnostics and local storage metrics.

## 📦 Core Components

### `IdentitySettingsPageComponent`

- **Role:** Displays the current user's federated identity and profile.
- **Key Feature:** Hosts the **Secure Wipe** entry point.

### `KeySettingsPageComponent`

- **Role:** visualizes the cryptographic identity.
- **Key Feature:** Displays the **Public Key Fingerprint** (SHA-256) for out-of-band verification.
- **Key Feature:** Allows **Identity Key Reset** (Scorched Earth regeneration of keys).

### `RoutingSettingsPageComponent`

- **Role:** Debugging dashboard.
- **Key Feature:** Metrics for Local IndexedDB (message counts).
- **Key Feature:** Tools to clear the Public Key Cache or Force Reconnect the socket.

### `SecureLogoutDialogComponent`

- **Role:** A specific "Danger Zone" dialog.
- **Behavior:** Explains the consequences of a "Hard Wipe" (loss of history) vs. a "Soft Logout" (session only).

## 🚀 Usage

Lazy load this library in your application routes:

```typescript
// app.routes.ts
{
  path: 'settings',
  loadChildren: () =>
    import('@nx-platform-application/messenger-settings-ui').then(m => m.settingsRoutes)
}
```

## 🔒 Security Notes

- **Hard Logout:** This library calls `ChatService.logout()` (alias for `fullDeviceWipe`). This is a destructive action intended for shared computers.
- **Key Reset:** Regenerating keys will cause "Safety Number Changed" warnings for all contacts. This is intended for device compromise scenarios.
