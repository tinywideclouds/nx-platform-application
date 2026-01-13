# 🔑 Platform Web Key Storage

**Layer:** Infrastructure
**Scope:** Platform (Shared)
**Package:** `@nx-platform-application/platform-infrastructure-web-key-storage`

## 🧠 Purpose

This library provides a secure, persistent storage engine specifically for **Cryptographic Keys** (JWK format).

It implements a dedicated IndexedDB database (`'platform'`) that is isolated from the application's main data (Messages/Contacts). This separation of concerns simplifies "Device Wipe" scenarios—we can nuke the Key DB to cryptographically lock the user out without immediately destroying their message history (or vice versa).

## 🏗 Architecture

- **Base Class:** Extends `PlatformDexieService` (from `infrastructure/indexed-db`) to inherit versioning and schema management.
- **Data Model:** Stores `JsonWebKey` objects, keyed by a URN string.
- **Usage:** Consumed by `messenger-infrastructure-key-cache` and `crypto-bridge`.

## 📦 Public API

### `WebKeyDbStore`

The concrete service provided in root.

| Method             | Description                                           |
| :----------------- | :---------------------------------------------------- | ------ |
| `saveJwk(id, key)` | Persists a JWK. Overwrites if ID exists.              |
| `loadJwk(id)`      | Returns `JsonWebKey                                   | null`. |
| `deleteJwk(id)`    | Removes a specific key.                               |
| `clearDatabase()`  | Wipes all keys (Equivalent to a Cryptographic Shred). |

## 💻 Usage Example

```typescript
import { Injectable, inject } from '@angular/core';
import { WebKeyDbStore } from '@nx-platform-application/platform-infrastructure-web-key-storage';

@Injectable()
export class KeyManager {
  private db = inject(WebKeyDbStore);

  async storeIdentityKey(userId: string, keyPair: CryptoKeyPair) {
    // Export to JWK before storage
    const jwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

    await this.db.saveJwk(`identity:${userId}`, jwk);
  }
}
```

## 🧪 Testing

This library uses the **Platform Dexie Mock** pattern. When testing services that depend on `WebKeyDbStore`, you should mock this service directly rather than relying on the underlying Dexie mocks.
