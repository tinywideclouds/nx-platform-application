// libs/platform/cloud-access/src/lib/models/cloud-provider.interface.ts

export interface CloudBackupMetadata {
  fileId: string;
  name: string;
  createdAt: string;
  sizeBytes: number;
}

/**
 * A generic provider contract.
 * T = The shape of the data being uploaded (usually a JSON object).
 */
export interface CloudStorageProvider {
  readonly providerId: 'google' | 'apple' | 'aws';

  /** Check if we have the scope/token to write files */
  hasPermission(): boolean;

  /** Trigger the auth popup */
  requestAccess(): Promise<boolean>;

  /**
   * Upload a generic payload.
   * If 'content' is not a Blob/String, the provider should JSON.stringify it.
   */
  uploadBackup(
    content: unknown,
    filename: string
  ): Promise<CloudBackupMetadata>;

  /** List files created by this app */
  listBackups(query?: string): Promise<CloudBackupMetadata[]>;

  /** Download a file and return the parsed JSON (or raw Blob if configured) */
  downloadBackup<T = unknown>(fileId: string): Promise<T>;
}
