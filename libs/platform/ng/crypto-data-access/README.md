# platform/crypto-data-access

This library provides a high-level "facade" service for orchestrating complex cryptographic workflows.

## Purpose

The `CryptoService` is the "smart facade" for all cryptographic operations. It hides the underlying complexity of coordinating key generation, storage, and retrieval.

It consumes two lower-level services:
1.  **`Crypto` (from `@nx-platform-application/sdk-core`):** The "toolbox" for raw cryptographic functions (e.g., `generateEncryptionKeys`).
2.  **`IndexedDb` (from `@nx-platform-application/platform/storage`):** The service for persisting keys to storage.

Consumer services (like `UserService` or `ChatService`) should **only** inject this `CryptoService` and never interact with the lower-level `Crypto` or `IndexedDb` services directly.

## Public API

This library exports:

* `CryptoService`: The root-provided Angular facade service.
* `PublicKeys`: The interface for exported public keys (`{ encKey: Uint8Array, sigKey: Uint8Array }`).
* `PrivateKeys`: The interface for raw private keys (`{ encKey: CryptoKey, sigKey: CryptoKey }`).

## Usage

Inject the service using Angular's `inject()` function.

```typescript
import { inject } from '@angular/core';
import { CryptoService } from '@nx-platform-application/platform/crypto-data-access';

// ... inside a service or component class

private cryptoService = inject(CryptoService);

// --- Generate & Store New Keys ---
// This one-line call generates two key pairs, stores them in
// IndexedDB, and returns the exported public keys.
async createNewKeys(userId: string) {
  try {
    const publicKeys = await this.cryptoService.generateAndStoreKeys(userId);
    console.log('New public keys:', publicKeys.encKey, publicKeys.sigKey);
    // Now you can send these Uint8Arrays to a server
  } catch (err) {
    console.error('Key generation failed:', err);
  }
}

// --- Load Existing Private Keys ---
// This loads the keys from IndexedDB and returns the raw
// CryptoKey objects needed for decryption/signing.
async loadMyPrivateKeys(userId: string) {
  try {
    const privateKeys = await this.cryptoService.loadMyKeys(userId);
    console.log('Private key loaded:', privateKeys.encKey);
    // Now you can use privateKeys.encKey for a decrypt operation
  } catch (err) {
    console.error('Failed to load keys:', err);
  }
}
