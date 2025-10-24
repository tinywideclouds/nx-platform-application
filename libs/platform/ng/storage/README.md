# platform/storage

This library provides a platform-level Angular service for secure, persistent storage of cryptographic keys using IndexedDB.

## Purpose

The `IndexedDb` service acts as a specialized wrapper around `Dexie.js` (an IndexedDB wrapper). Its sole responsibility in this platform is to **store, load, and delete `CryptoKeyPair` objects** associated with a user ID.

This service is intentionally kept separate from application-state storage to maintain a clean separation of concerns. It is consumed by other platform services (like `platform/crypto-data-access`) and is not intended to be used directly by feature modules.

## Public API

This library exports:

* `IndexedDb`: The root-provided Angular service.
* `StorageProvider`: The interface the service implements.
* `KeyPairRecord`: The data model for a stored key pair (using `JsonWebKey` format).

## Usage

Inject the service using Angular's `inject()` function.

```typescript
import { inject } from '@angular/core';
import { IndexedDb } from '@nx-platform-application/platform/storage';

// ... inside a service or component class

private storage = inject(IndexedDb);

// --- Storing a Key Pair ---
// (Assuming 'myKeyPair' is a CryptoKeyPair object)
async storeKeys(userId: string, myKeyPair: CryptoKeyPair) {
  await this.storage.saveKeyPair(userId, myKeyPair);
}

// --- Loading a Key Pair ---
async loadKeys(userId: string) {
  const keyPair = await this.storage.loadKeyPair(userId);

  if (keyPair) {
    // Use the { publicKey, privateKey } object
    console.log('Keys loaded:', keyPair.privateKey);
  } else {
    console.log('No keys found for this user.');
  }
}

// --- Deleting a Key Pair ---
async deleteKeys(userId: string) {
  await this.storage.deleteKeyPair(userId);
}
