# Messenger Domain: Key Manager

**The "Me" Service.**

This library is responsible for the lifecycle of the **Current User's Identity**.
It manages the creation, storage, and publication of cryptographic keys.

## Responsibilities

1.  **Creation:** Generates new OMEMO/Signal key pairs via the crypto infrastructure.
2.  **Publication:** Ensures Public Keys are pushed to the Local Cache (and subsequently the Network).
3.  **Restoration:** Loads private keys on session start and performs "Self-Healing" if public keys are missing from the cache.
4.  **Import:** Handles keys transferred from other devices (Linking).

## Usage

```typescript
// Create a new identity (and publish to email alias)
const keys = await keyLifecycle.createIdentity(authUrn, emailUrn);

// Restore session
const keys = await keyLifecycle.restoreIdentity(authUrn);

// Flush local cache (Debug/Maintenance)
await keyLifecycle.clearCache();
```

## Architecture

This service sits between the State Layer (Identity Facade) and the Infrastructure Layer (Private Key Storage + Public Key Cache).

- Upstream: ChatIdentityFacade

- Downstream: PrivateKeyService (IndexedDB), KeyCacheService (Dexie/Server)
