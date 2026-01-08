# Platform Infrastructure Storage

A pluggable, cloud-agnostic storage library designed to abstract file system operations behind a unified contract. This library implements the **Strategy Pattern**, allowing applications to switch between storage providers (e.g., Google Drive, Dropbox, Local Storage) without modifying domain logic.

## Architecture

The core of this library is the `VaultProvider` abstract class, which defines the standard contract for all storage operations.

- **Contract:** `VaultProvider` (Auth, Read, Write, List)
- **Injection:** `VaultDrivers` (Multi-provider token)
- **Configuration:** `PlatformStorageConfig` (API keys)

## 1. Installation & Configuration

To use the storage infrastructure, you must provide the configuration and the specific drivers you wish to enable in your application's root provider set (e.g., `app.config.ts` or `AppModule`).

### Providing the Google Drive Driver

```typescript
// app.config.ts
import { provideValues } from '@angular/core';
import { VaultDrivers, PlatformStorageConfig, GoogleDriveDriver } from '@platform/infrastructure/storage';

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

    // 2. Register Drivers (Multi-provider)
    {
      provide: VaultDrivers,
      useClass: GoogleDriveDriver,
      multi: true,
    },
  ],
};
```

## 2. Usage

Inject the `VaultDrivers` token to access the list of available storage providers.

```typescript
import { Component, Inject } from '@angular/core';
import { VaultDrivers, VaultProvider } from '@platform/infrastructure/storage';

@Component({ ... })
export class StorageComponent {
  constructor(@Inject(VaultDrivers) private drivers: VaultProvider[]) {}

  async connectToDrive() {
    // Select Google Drive from the list
    const drive = this.drivers.find(d => d.providerId === 'google');

    if (drive) {
      const success = await drive.link(true); // true = persist session
      if (success) {
        console.log('Connected to Google Drive!');
      }
    }
  }

  async saveData(data: any) {
    const drive = this.drivers.find(d => d.providerId === 'google');
    // Write a file (blindCreate = true skips existence check for speed)
    await drive.writeJson('2024/data.json', data, { blindCreate: true });
  }
}

```

## 3. Implementing New Drivers

To add a new storage provider (e.g., `DropboxDriver`), extend the `VaultProvider` abstract class:

```typescript
import { Injectable } from '@angular/core';
import { VaultProvider, WriteOptions } from './vault.provider';

@Injectable()
export class DropboxDriver implements VaultProvider {
  readonly providerId = 'dropbox';
  readonly displayName = 'Dropbox';

  isAuthenticated(): boolean {
    // ... implementation
  }

  async link(persist: boolean): Promise<boolean> {
    // ... implementation
  }

  // ... implement remaining abstract methods
}
```

## Running Unit Tests

Run `nx test platform-infrastructure-storage` to execute the unit tests via Vitest.
