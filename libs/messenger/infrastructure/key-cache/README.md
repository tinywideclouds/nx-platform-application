# 📖 @nx-platform-application/messenger-key-cache

This library implements a **Read-Through Cache** for public keys. It sits between the application and the remote Key Service, reducing network calls and providing offline capabilities.

It uses a "Stale-While-Revalidate" inspired strategy (though strictly synchronous for safety): if a key is local and fresh, it is returned instantly. If missing or stale, it is fetched from the network.

## Dependencies

- **`@nx-platform-application/messenger-key-storage`**: The persistent IndexedDB adapter.
- **`@nx-platform-application/messenger-key-access`**: The remote API client (`SecureKeyService`).
- **`@js-temporal/polyfill`**: Used for robust, timezone-safe timestamp calculations.

## Primary API

### `KeyCacheService`

An `@Injectable` Angular service.

**`getPublicKey(urn: URN): Promise<PublicKeys>`**

- The main entry point for retrieving a key.
- **Logic Flow:**
  1.  **Check DB:** Looks for the key in `messenger_keys`.
  2.  **Check Freshness:** Calculates `age = now - stored_timestamp`.
  3.  **Return Local:** If `age < 16 hours`, returns the cached key immediately.
  4.  **Fetch Remote:** If missing or stale, calls `SecureKeyService.getKey(urn)`.
  5.  **Update Cache:** Saves the new key and current timestamp to DB before returning.

**`hasKeys(urn: URN): Promise<boolean>`**

- A lightweight check to see if a key exists (either locally or remotely) without throwing an error.
- Useful for UI guards (e.g., "Can I start a chat with this user?").

**`storeKeys(urn: URN, keys: PublicKeys): Promise<void>`**

- Uploads a user's own keys to the backend AND updates the local cache simultaneously.
- Ensures **Read-Your-Writes consistency**: after uploading, the local cache immediately reflects the new key, preventing unnecessary network fetches.

**`clear(): Promise<void>`**

- Wipes the entire cache.

## Configuration

- **TTL (Time-To-Live):** Currently hardcoded to **16 hours**. This balances security (key rotation) with performance.

## Running unit tests

Run `nx test messenger-key-cache` to execute the unit tests for this library.
