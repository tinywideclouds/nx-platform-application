// libs/platform/infrastructure/storage/src/lib/vault.provider.ts

export interface WriteOptions {
  /**
   * If true, the provider will attempt to create the file directly
   * without checking if it already exists.
   * USE CASE: Writing immutable 'Delta' files with unique timestamps.
   */
  blindCreate?: boolean;
}

export type Visibility = 'public' | 'private';

export interface AssetResult {
  resourceId: string;
  provider: 'google-drive' | 'dropbox' | 'microsoft-drive';
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

  /**
   * [NEW] Uploads a raw binary asset (Image, Video).
   * Returns the public/shareable URL of the asset.
   */
  abstract uploadAsset(
    main: Blob,
    filename: string,
    visibility: Visibility,
    mimeType: string | undefined,
  ): Promise<AssetResult>;

  abstract getDriveLink(assetId: string, preview?: boolean): Promise<string>;
  abstract downloadAsset(assetId: string): Promise<string>;

  abstract fileExists(path: string): Promise<boolean>;
  abstract listFiles(directory: string): Promise<string[]>;
}
