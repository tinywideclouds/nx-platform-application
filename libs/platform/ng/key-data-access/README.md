# Key Data Access Library

This Angular library provides a "smart facade" service (`KeyService`) for interacting with the `go-key-service`.

## Purpose

The `go-key-service` is a "dumb" byte store; it only stores and returns a single raw binary blob for each user.

The purpose of this `KeyService` is to **hide that implementation** from the rest of the Angular application. It acts as an abstraction layer, exposing a clean, future-proof interface (`PublicKeys { encKey, sigKey }`) for other services to use.

## Public API

### `PublicKeys` Interface

The "smart" object used by the application.

```typescript
export interface PublicKeys {
  /**
   * The raw public encryption key.
   */
  encKey: Uint8Array;
  
  /**
   * The raw public signature key.
   * (Included for future-proofing, but currently unused).
   */
  sigKey: Uint8Array;
}
