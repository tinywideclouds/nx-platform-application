# 📖 @nx-platform-application/messenger-key-access

This library provides the `SecureKeyService`, a critical component for the "Sealed Sender" encryption architecture. It is the _only_ service in the Angular application responsible for communicating with the `go-key-service` backend.

## Purpose

This service handles the **Read (GET)** and **Write (POST)** operations for a user's public keys (`PublicKeys`) against the `/api/keys/{urn}` endpoint.

It is designed to be a "smart" client:

- **Type Safety:** It speaks in terms of platform types (`URN`, `PublicKeys`).
- **Serialization:** It uses shared mappers to convert `Uint8Array` keys to/from the base64 JSON format expected by the backend.
- **Caching:** It provides an in-memory `Map` cache for `getKey` requests to reduce network load.

## Primary API

### `SecureKeyService`

An `@Injectable` Angular service that provides the following public methods:

**`getKey(userId: URN): Promise<PublicKeys | null>`**

- Fetches the public encryption and signing keys for a given user.
- **Resilient 404s:** If the user has not uploaded keys yet (404), this method returns `null` instead of throwing an error.
- **Caching:** Checks an internal cache first. On a cache miss, performs an HTTP `GET` to `/api/keys/{urn}`.
- **Format:** Uses `deserializeJsonToPublicKeys` to convert the raw JSON response.

**`storeKeys(userUrn: URN, keys: PublicKeys): Promise<void>`**

- Uploads a user's keys to the backend.
- **Endpoint:** POSTs to `/api/keys/{urn}`.
- **Cache Invalidation:** On success, it automatically invalidates the local cache for that user to ensure subsequent reads are fresh.
- **Format:** Uses `serializePublicKeysToJson` to create the payload.

**`clearCache(): void`**

- A simple utility method to clear the entire in-memory key cache.

## Running unit tests

Run `nx test messenger-key-access` to execute the unit tests for this library.
