# 📦 Platform Infrastructure Storage

**Layer:** Infrastructure
**Scope:** Platform (Shared)

A pluggable, cloud-agnostic storage library designed to abstract file system operations behind a unified contract. This library implements the **Strategy Pattern**, allowing applications to switch between storage providers (e.g., Google Drive, Dropbox) without modifying domain logic.

## 🏗 Architecture

The core of this library is the `VaultProvider` abstract class, which defines the standard contract for all storage operations.

- **Contract:** `VaultProvider` (Auth, Read, Write, List, Upload Asset)
- **Injection:** `VaultDrivers` (Multi-provider token)
- **Configuration:** `PlatformStorageConfig` (API keys)

## 📦 Capabilities

| Feature         | Description                             | Google Drive Impl                   |
| :-------------- | :-------------------------------------- | :---------------------------------- |
| **Auth**        | OAuth2 Popup / Redirect flow            | ✅ (Client-side & Server-side Code) |
| **Data Plane**  | Read/Write JSON objects                 | ✅ (`appDataFolder` or root)        |
| **Asset Plane** | Resumable binary uploads (Images/Video) | ✅ (Resumable Upload API)           |
| **Sharing**     | Generate public read-only links         | ✅ (Permissions API)                |

## 🔨 Installation & Configuration

To use the storage infrastructure, provide the configuration and specific drivers in your application's root provider set.

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { VaultDrivers, PlatformStorageConfig, GoogleDriveDriver, GOOGLE_TOKEN_STRATEGY, LocalClientStrategy } from '@nx-platform-application/platform-infrastructure-storage';

export const appConfig: ApplicationConfig = {
  providers: [
    // 1. Configure API Keys
    {
      provide: PlatformStorageConfig,
      useValue: {
        googleClientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
        googleApiKey: 'YOUR_API_KEY',
      },
    },
    // 2. Choose an Auth Strategy (e.g., Local Popup or Server-Side)
    {
      provide: GOOGLE_TOKEN_STRATEGY,
      useClass: LocalClientStrategy,
    },
    // 3. Register Drivers (Multi-provider)
    {
      provide: VaultDrivers,
      useClass: GoogleDriveDriver,
      multi: true,
    },
  ],
};
```

## 💻 Usage Example

### 1. Basic JSON Storage

```typescript
@Component({ ... })
export class StorageComponent {
  constructor(@Inject(VaultDrivers) private drivers: VaultProvider[]) {}

  async saveData(data: any) {
    const drive = this.drivers.find(d => d.providerId === 'google');

    // Write a file (blindCreate = true skips existence check for speed)
    await drive.writeJson('2024/settings.json', data, { blindCreate: true });
  }
}

```

### 2. Uploading Public Assets

The `uploadAsset` method handles large binaries using resumable uploads (via `fetch`) and can automatically set file permissions to "Public".

```typescript
async uploadProfilePicture(file: File) {
  const drive = this.drivers.find(d => d.providerId === 'google');

  // Returns { resourceId: '...', provider: 'google-drive' }
  const result = await drive.uploadAsset(
    file,
    `avatars/${file.name}`,
    'public', // Visibility: 'public' | 'private'
    file.type
  );

  console.log('Uploaded ID:', result.resourceId);
}

```

## ⚠️ Implementation Notes

- **Google Drive Uploads:** The driver uses the native `fetch` API for binary uploads to support the "Resumable Upload" protocol, bypassing the GAPI client limitations for large files.
- **Error Handling:** All methods return Promises. Authentication errors (e.g., 401/403) are generally thrown and should be caught by the State Layer.

```

### Checklist Status
* **Code:** ✅ Verified & Refactored.
* **Tests:** ✅ Passing (Includes `fetch` mocking).
* **Docs:** ✅ Synchronized (Added Asset Upload & Auth Strategy details).

This library is now **Baselined**. Ready to move to the next component in the stack.

```
