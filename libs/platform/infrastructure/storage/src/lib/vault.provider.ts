// libs/platform/infrastructure/storage/src/lib/vault.provider.ts

export interface WriteOptions {
  /**
   * If true, the provider will attempt to create the file directly
   * without checking if it already exists.
   * USE CASE: Writing immutable 'Delta' files with unique timestamps.
   */
  blindCreate?: boolean;
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

  /**
   * Writes a JSON object to the vault.
   * @param path - e.g., '2026/01/deltas/msg_123.json'
   * @param data - The JSON object to store.
   * @param options - Configuration for write behavior (e.g., blind writes).
   */
  abstract writeJson(
    path: string,
    data: unknown,
    options?: WriteOptions,
  ): Promise<void>;

  abstract readJson<T>(path: string): Promise<T | null>;
  abstract fileExists(path: string): Promise<boolean>;
  abstract listFiles(directory: string): Promise<string[]>;

  /**
   * SHARING (BYOS Rich Media)
   * Uploads a raw blob (image/video) to a public-read location.
   * Returns a "Capability URL" (e.g. Google Drive WebViewLink).
   */
  abstract uploadPublicAsset(
    blob: Blob,
    filename: string,
    type: string | undefined,
  ): Promise<string>;
}
