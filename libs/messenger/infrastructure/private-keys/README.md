# 📖 Messenger Infrastructure: Private Keys

> **Role:** The Mechanic (Local Vault)  
> **Responsibility:** Manages the lifecycle of the user's _Local Identity_ (Private Keys).

This library serves as the **Hardware Abstraction Layer** for the device's cryptographic identity. It interfaces directly with the browser's `IndexedDB` and `Web Crypto API` to securely create, store, and retrieve keys.

**It is strictly a Local Service.** It does _not_ know about the network, the backend API, or the "Sealed Sender" protocol.

## Architecture

## Dependencies

- **`@nx-platform-application/platform-web-key-storage`**: Persists keys to IndexedDB.
- **`./crypto.ts`**: Helper wrapping the Web Crypto API.

## API: `PrivateKeyService`

### 1. Key Lifecycle

- **`generateAndStoreKeys(urn)`**:
  - Generates RSA-OAEP (Encryption) and RSA-PSS (Signing) pairs.
  - **Saves** Private Keys to the local `IndexedDB`.
  - **Returns** the `PrivateKeys` (for the session) and `PublicKeys` (for the caller to publish).
- **`loadMyKeys(urn)`**:
  - Retrieves the `WebCryptoKeys` (CryptoKey objects) from storage.
  - Used during session initialization.

### 2. Import / Export

- **`storeMyKeys(urn, keys)`**:
  - Imports `CryptoKey` objects (e.g., from Device Linking) into local storage.

- **`loadMyPublicKeys(urn)`**:
  - Derives the `PublicKeys` (SPKI bytes) from the stored identity.
  - Used by the Domain Layer to "Repair" the public directory if it gets out of sync.

### 3. Helpers

- **`verifyKeysMatch(urn, remoteKeys)`**:
  - A utility to byte-compare the local public identity against a remote set of keys.
