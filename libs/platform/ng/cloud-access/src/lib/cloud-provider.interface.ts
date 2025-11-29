// libs/platform/cloud-access/src/lib/cloud-storage-provider.interface.ts

import { BackupFile } from './models/cloud-storage.models';

export interface CloudStorageProvider {
  /** unique identifier (e.g., 'google-drive', 'dropbox') */
  readonly providerId: string;

  /** Display name for UI (e.g., 'Google Drive') */
  readonly displayName: string;

  // --- AUTHENTICATION ---

  /**
   * Request OAuth/API access from the user.
   */
  requestAccess(): Promise<boolean>;

  /**
   * Check if we currently hold a valid token.
   */
  hasPermission(): boolean;

  /**
   * Disconnect/Logout.
   */
  revokeAccess(): Promise<void>;

  // --- FILE MANAGEMENT (Low Level) ---

  /**
   * Lists files matching a specific prefix or name.
   * Used to find manifests, vaults, and indexes.
   */
  listBackups(filenamePrefix: string): Promise<BackupFile[]>;

  /**
   * GENERIC UPLOAD:
   * Uploads any serializable object as a JSON file.
   * Used for: 'chat_index.json', 'chat_manifest_2024_01.json'
   */
  uploadFile<T>(data: T, filename: string): Promise<void>;

  /**
   * GENERIC DOWNLOAD:
   * Downloads a file and parses it as JSON.
   * Returns null if file not found.
   */
  downloadFile<T>(filename: string): Promise<T | null>;

  // --- DOMAIN BACKUP (High Level) ---

  /**
   * Uploads a domain-specific backup artifact (Vault).
   * Providers *may* apply compression or encryption here.
   */
  uploadBackup(data: any, filename: string): Promise<void>;

  /**
   * Downloads a domain-specific backup artifact.
   * Providers *may* decompress or decrypt here.
   */
  downloadBackup<T>(fileId: string): Promise<T>;
}
