import {
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-storage';

export interface CloudBackupMetadata {
  /** The provider-specific unique ID (e.g., Google Drive File ID) */
  fileId: string;
  /** Display name (e.g., "contacts-backup-2025-11-26.json") */
  name: string;
  /** ISO Date String */
  createdAt: string;
  /** Size in bytes */
  sizeBytes: number;
}

export interface BackupPayload {
  /** Matches the local database schema version (e.g., 4) */
  version: number;
  /** ISO Date String of when the snapshot was taken */
  timestamp: string;
  /** Metadata about where this backup came from (e.g., "Web - Chrome 114") */
  sourceDevice: string;

  /** The core data payload */
  contacts: Contact[];
  groups: ContactGroup[];

  // NOTE: 'Blocked' and 'Pending' lists are excluded per architectural decision
  // to keep those App-Specific / Local-Only for now.
}

export interface CloudStorageProvider {
  readonly providerId: 'google' | 'apple' | 'aws';

  /**
   * 1. Permission Check (Synchronous)
   * Checks if the current auth token ALREADY has the required scope
   * (e.g., 'https://www.googleapis.com/auth/drive.file').
   * This allows the UI to show a "Connect Drive" button vs. "Backup Now".
   */
  hasPermission(): boolean;

  /**
   * 2. Authorize (Async / User Interaction)
   * Triggers the provider's incremental auth popup.
   * @returns true if the user granted the scope, false if denied.
   */
  requestAccess(): Promise<boolean>;

  /**
   * 3. Upload Operation
   * Uploads the JSON payload. Should target the "App Data" folder if supported.
   */
  uploadBackup(
    payload: BackupPayload,
    filename: string
  ): Promise<CloudBackupMetadata>;

  /**
   * 4. List Operation
   * Returns a list of backups created by this specific app.
   */
  listBackups(): Promise<CloudBackupMetadata[]>;

  /**
   * 5. Download Operation
   * Fetches and parses the JSON content of a specific backup file.
   */
  downloadBackup(fileId: string): Promise<BackupPayload>;
}
