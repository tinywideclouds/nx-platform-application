# Platform Domain Storage

The **Orchestration Layer** for the application's file system interactions. This library provides a unified, reactive service (`StorageService`) that manages authentication state, driver selection, and session persistence, abstracting the complexity of specific infrastructure drivers (Google Drive, Dropbox, etc.) from the rest of the app.

## Architecture

- **Role:** Orchestrator / Singleton Service
- **Dependencies:** Consumes `VaultDrivers` (Infrastructure Layer)
- **Consumers:** Application Engines (e.g., `ChatVault`, `ContactsSync`)

## 1. Features

- **Driver Agnostic:** The service doesn't know _which_ provider is active, only that it adheres to the `VaultProvider` contract.
- **Reactive State:** Exposes `activeProviderId` and `isConnected` as Angular Signals.
- **Session Restoration:** Automatically checks `localStorage` on startup to restore the user's previous cloud connection (e.g., re-linking Google Drive without a prompt).
- **Public Assets:** Provides a unified `uploadPublicAsset` API that handles the nuances of making a file publicly readable on the active provider.

## 2. Usage

Inject `StorageService` to manage the cloud connection or perform generic file I/O.

### Connecting a Provider

```typescript
import { Component, inject } from '@angular/core';
import { StorageService } from '@platform/domain/storage';

@Component({ ... })
export class ConnectionComponent {
  storage = inject(StorageService);

  // Signals for template binding
  isConnected = this.storage.isConnected;
  activeProvider = this.storage.activeProviderId;

  async connectGoogle() {
    await this.storage.connect('google');
  }

  async disconnect() {
    await this.storage.disconnect();
  }
}

```

### Performing File I/O

Domain engines should use `getActiveDriver()` to perform operations.

```typescript
export class ContactsSyncEngine {
  storage = inject(StorageService);

  async saveBackup(data: any) {
    const driver = this.storage.getActiveDriver();
    if (!driver) throw new Error('No cloud storage connected');

    await driver.writeJson('backups/contacts.json', data);
  }
}
```

## 3. Configuration

Ensure the infrastructure drivers are provided in your root `app.config.ts`. This domain service will automatically inject the `VaultDrivers` token to find them.

```typescript
// app.config.ts
providers: [
  // ... infrastructure config
  { provide: VaultDrivers, useClass: GoogleDriveDriver, multi: true },
];
```

## Running Unit Tests

Run `nx test platform-domain-storage` to execute the unit tests via Vitest.
