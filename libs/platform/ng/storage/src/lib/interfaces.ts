// --- FILE: libs/platform/ng/storage/src/lib/interfaces.ts ---
// (FULL CODE)

/**
 * A generic interface for storing and retrieving JWKs.
 */
export interface StorageProvider {
  /**
   * Saves a single JsonWebKey by its ID.
   * @param id A unique ID for this key.
   * @param key The JsonWebKey to store.
   */
  saveJwk(id: string, key: JsonWebKey): Promise<void>;

  /**
   * Loads a single JsonWebKey by its ID.
   * @param id The unique ID of the key to load.
   */
  loadJwk(id: string): Promise<JsonWebKey | null>;

  /**
   * Deletes a single JsonWebKey by its ID.
   * @param id The unique ID of the key to delete.
   */
  deleteJwk(id: string): Promise<void>;
}