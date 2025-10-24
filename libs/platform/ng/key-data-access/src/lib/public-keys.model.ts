/**
 * The "smart" public-facing interface for the KeyService.
 * Other services will send and receive this object.
 * * NOTE: The underlying Go service only stores the `encKey`.
 * The `sigKey` is included here for future-proofing and is
 * currently always an empty Uint8Array.
 */
export interface PublicKeys {
  /**
   * The raw public encryption key.
   */
  encKey: Uint8Array;

  /**
   * The raw public signature key.
   * (Currently unused, will be an empty Uint8Array).
   */
  sigKey: Uint8Array;
}
