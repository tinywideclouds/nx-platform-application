# 📖 @nx-platform-application/messenger-key-storage

This library provides the **Persistent Storage Adapter** for public keys within the Messenger application. It wraps IndexedDB (via Dexie.js) to allow offline access to keys and reduce network round-trips.

It is a "dumb" storage layer. It does not handle expiration logic, fetching strategies, or cryptography. It simply persists what it is given.

## Database Architecture

This library creates a **dedicated database** instance separate from the main message store. This allows for granular data management (e.g., wiping keys without deleting message history).

- **Database Name:** `messenger_keys`
- **Table:** `publicKeys`
- **Schema:** `&urn, timestamp` (Primary Key: `urn`, Indexed: `timestamp`)

## Primary API

### `KeyStorageService`

An `@Injectable` Angular service that provides direct access to the underlying IndexedDB table.

**`storeKey(urn: string, keys: Record<string, string>, timestamp: ISODateTimeString): Promise<void>`**
- Persists a key record.
- **Upsert:** If a record with the same URN exists, it is overwritten.
- **Format:** Keys are stored as a raw JSON-compatible Record (usually Base64 encoded), keeping the storage layer agnostic of the specific crypto implementation.

**`getKey(urn: string): Promise<PublicKeyRecord | null>`**
- Retrieves a record by its URN string.
- Returns `null` if no record exists.

**`clearDatabase(): Promise<void>`**
- Truncates the `publicKeys` table.
- Typically called during the **Logout** workflow to ensure no stale data leaks to the next user session.

## Dependencies

- **`@nx-platform-application/platform-dexie-storage`**: The base class providing the Dexie instance and error handling.
- **`@nx-platform-application/platform-types`**: Shared domain types (`ISODateTimeString`).

## Running unit tests

Run `nx test messenger-key-storage` to execute the unit tests for this library.