# 📦 Platform Domain Storage

**Layer:** Domain
**Scope:** Platform (Shared)

The **Storage Orchestrator** for the application. This library provides a unified, reactive service (`StorageService`) that manages authentication state, driver selection, and session persistence.

It abstracts the complexity of specific infrastructure drivers (Google Drive, Dropbox, Local) from the feature layers (Messenger, Contacts).

## 🏗 Architecture

- **Role:** Singleton Orchestrator.
- **Dependencies:** Consumes `VaultDrivers` (from Infrastructure Layer).
- **Consumers:** State Services (e.g., `CloudSyncService`, `ChatDataService`).

## 📦 Public API

### `StorageService`

The primary entry point.

| Method               | Description            | Usage Context                                                                                                                       |
| :------------------- | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `activeProviderId()` | \*\*Signal<string      | null>\*\*                                                                                                                           | Reactive signal of the currently active provider ID (e.g., `'google'`). |
| `isConnected()`      | **Signal<boolean>**    | Computed signal for UI binding.                                                                                                     |
| `connect(id)`        | `Promise<boolean>`     | **Interactive**. Triggers the driver's login flow (e.g., OIDC Popup). Used when user clicks "Link Account".                         |
| `resume(id)`         | `boolean`              | **Silent**. Activates a driver _without_ triggering login UI. Used by `CloudSyncService` after verifying a server-side link exists. |
| `disconnect()`       | `Promise<void>`        | Unlinks the driver and clears local persistence.                                                                                    |
| `uploadAsset(...)`   | `Promise<AssetResult>` | **Universal Upload**. Handles MIME types, visibility, and provider-specific upload protocols (e.g., Resumable Uploads).             |
| `getActiveDriver()`  | `VaultProvider         | null`                                                                                                                               | Returns the raw driver instance for direct file I/O (Read/Write JSON).  |

## 💻 Usage Examples

### 1. The "Silent Boot" (Resume)

Used by the App Boot sequence to restore a connection if the backend confirms validity.

```typescript
// cloud-sync.service.ts
if (serverStatus.google) {
  // We trust the server, so we 'resume' the local driver immediately
  this.storage.resume('google');
}
```

### 2. The "Interactive Link" (Connect)

Used by the Settings UI when a user explicitly wants to add a provider.

```typescript
// settings.component.ts
async linkGoogle() {
  const success = await this.storage.connect('google');
  if (success) {
    this.toast.success('Google Drive Linked');
  }
}

```

### 3. Uploading Public Assets

Used by the Media State layer to upload images/attachments.

```typescript
// media.facade.ts
async uploadProfile(file: File) {
  try {
    const result = await this.storage.uploadAsset(
      file,
      'avatar.png',
      'public', // Sets ACL to public-read
      'image/png'
    );
    return result.resourceId;
  } catch (e) {
    // Handle "No Provider Connected" or Upload failures
  }
}

```

## 🔧 Configuration

This library does not define the drivers themselves. It injects them via the `VaultDrivers` token. Ensure your application root provides the infrastructure drivers:

```typescript
// app.config.ts
providers: [
  // ... infrastructure providers
  { provide: VaultDrivers, useClass: GoogleDriveDriver, multi: true },
];
```
