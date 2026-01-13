# 🔌 @nx-platform-application/platform-drive-integrations

**Layer:** Infrastructure
**Scope:** Platform (Shared)

This library provides the HTTP clients for interacting with the Server-Side Integration API (e.g., Google Drive, Dropbox).

It handles raw network communication, error handling, and `Promise` conversion, delegating type definitions to the shared domain layer.

## 📦 Dependencies

- **`@nx-platform-application/platform-types`**: Source of the `IntegrationStatus` interface.
- **`@nx-platform-application/console-logger`**: For standardized logging.

## 📦 Public API

### `IntegrationApiService`

The primary service for managing third-party account linking.

- `getStatus()`: Returns `Promise<IntegrationStatus>`. Checks which providers are currently linked.
- `disconnect(provider: 'google')`: Returns `Promise<void>`. Revokes the server-side link.

## 🔨 Usage Example

```typescript
import { Component, inject, signal } from '@angular/core';
import { IntegrationApiService } from '@nx-platform-application/platform-infrastructure-drive-integrations';
// Note: Type is imported from the shared types lib, not the infra lib
import { IntegrationStatus } from '@nx-platform-application/platform-types';

@Component({ ... })
export class IntegrationsComponent {
  private api = inject(IntegrationApiService);

  protected status = signal<IntegrationStatus | null>(null);

  async checkConnections() {
    // Returns { google: boolean, dropbox: boolean }
    const result = await this.api.getStatus();
    this.status.set(result);
  }
}
```

⚠️ Error Handling Strategy
getStatus: Fail-safe. If the API fails, it returns a default "disconnected" object ({ google: false, ... }) to prevent blocking the UI.

disconnect: Propagates errors. The caller (State Layer) should handle potential failures during user-initiated actions.
