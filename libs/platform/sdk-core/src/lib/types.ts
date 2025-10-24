/**
 * A branded type for ISO 8601 date-time strings.
 * This provides compile-time safety to ensure we don't accidentally
 * assign a regular string (e.g., "hello world") to a field that expects a timestamp.
 * It is still just a string at runtime.
 */
export type ISODateTimeString = string & { readonly __brand: 'ISODateTimeString' };

export interface PublicKeys {
  encKey: Uint8Array;
  sigKey: Uint8Array;
}

export interface PrivateKeys {
  encKey: CryptoKey; // The raw private key object
  sigKey: CryptoKey; // The raw private key object
}
