# 📖 @nx-platform-application/key-v2-access

This library provides the `SecureKeyService`, a critical component for the "Poke-then-Pull" architecture. It is the _only_ service in the Angular application responsible for communicating with the V2 `go-key-service` backend.

## Purpose

This service handles the **Read (GET)** and **Write (POST)** operations for a user's public keys (`PublicKeys`) against the `/api/v2/keys/{urn}` endpoint.

It is designed to be a "smart" client:

- It speaks in terms of "smart" platform types (`URN`, `PublicKeys`).
- It uses mappers from `@nx-platform-application/platform-types` to handle the serialization (Smart Object -> JSON) and deserialization (JSON -> Smart Object) logic.
- It provides an in-memory cache for `getKey` requests to reduce network load.

## Primary API

### `SecureKeyService`

An `@Injectable` Angular service that provides the following public methods:

**`getKey(userId: URN): Promise<PublicKeys>`**

- Fetches the public encryption and signing keys for a given user.
- Checks an internal `Map` cache first.
- On a cache miss, performs an HTTP `GET` to `/api/v2/keys/{urn}`.
- Uses `deserializeJsonToPublicKeys` to convert the raw JSON response into a `PublicKeys` object.
- Caches the result and returns it.

**`storeKeys(userUrn: URN, keys: PublicKeys): Promise<void>`**

- Uploads (persists) a user's own public keys to the backend.
- This is the "write" operation used during the initial key generation flow (see `messenger-crypto-access`).
- Uses `serializePublicKeysToJson` to convert the `Uint8Array` keys into a JSON-safe, Base64-encoded object for the POST body.
- On success, it automatically invalidates the local cache for that user.

**`clearCache(): void`**

- A simple utility method to clear the entire in-memory key cache.

## Running unit tests

Run `nx test key-v2-access` to execute the unit tests for this library.
