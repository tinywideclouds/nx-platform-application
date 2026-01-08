import { InjectionToken } from '@angular/core';

export const VAULT_PROVIDER = new InjectionToken<VaultProvider>(
  'VAULT_PROVIDER',
);

export interface VaultProvider {
  readonly providerId: string;
  readonly displayName: string;

  /**
   * AUTHENTICATION
   */

  /** * Triggers the provider's login flow (Popup/Redirect).
   * @param persist - If true, stores the refresh token locally.
   */
  link(persist: boolean): Promise<boolean>;

  /** Destroys the local session. */
  unlink(): Promise<void>;

  /** Returns true if we have a valid access token (or can refresh one). */
  isAuthenticated(): boolean;

  /**
   * STORAGE (The "Append-Only" Primitives)
   */

  /** * Writes a JSON object to the vault.
   * @param path - e.g., '2026/01/deltas/msg_123.json'
   */
  writeJson(path: string, data: unknown): Promise<void>;

  /** * Reads a JSON object. Returns null if missing.
   */
  readJson<T>(path: string): Promise<T | null>;

  /**
   * Lists all files in a "directory".
   * Used to find all Deltas: listFiles('2026/01/deltas')
   */
  listFiles(directory: string): Promise<string[]>;

  /**
   * SHARING (For Rich Text / Media)
   */

  /**
   * Uploads a raw blob (image/video) and returns a generic "Capability URL".
   * The URL should be accessible to anyone with the link (we encrypt the link itself).
   */
  uploadPublicAsset(blob: Blob, filename: string): Promise<string>;
}
