// libs/platform/infrastructure/storage/src/lib/vault.provider.ts

export interface WriteOptions {
  /**
   * If true, the provider will attempt to create the file directly
   * without checking if it already exists.
   * USE CASE: Writing immutable 'Delta' files with unique timestamps.
   */
  blindCreate?: boolean;
}

export interface AssetResult {
  /** Optimized for chat bubbles (e.g., 1200px, JPEG for compatibility) */
  inlineUrl: string;
  /** Full resolution for Lightbox/Zoom (Original format) */
  originalUrl: string;
}

export abstract class VaultProvider {
  abstract readonly providerId: string;
  abstract readonly displayName: string;

  /**
   * AUTHENTICATION
   * Triggers the provider's specific login flow (e.g. Google Popup).
   * @param persist - If true, the infrastructure should attempt to store the session.
   */
  abstract link(persist: boolean): Promise<boolean>;

  /**
   * Destroys the local session/token.
   */
  abstract unlink(): Promise<void>;

  /**
   * Returns true if we have a valid access token available for requests.
   */
  abstract isAuthenticated(): boolean;

  /**
   * STORAGE (Append-Only Primitives)
   */

  // --- DATA PLANE (Structured) ---
  /**
   * Serializes and saves an object.
   * Implementation should handle "Create vs Update" logic.
   */
  abstract writeJson(
    path: string,
    data: unknown,
    options?: WriteOptions,
  ): Promise<void>;

  /**
   * Reads and parses a JSON object.
   */
  abstract readJson<T>(path: string): Promise<T | null>;

  // --- DATA PLANE (Binary) ---
  /**
   * [NEW] Uploads a raw binary asset (Image, Video).
   * Returns the public/shareable URL of the asset.
   */
  abstract uploadAsset(
    blob: Blob,
    filename: string,
    mimeType: string | undefined,
  ): Promise<AssetResult>;

  abstract fileExists(path: string): Promise<boolean>;
  abstract listFiles(directory: string): Promise<string[]>;
}
