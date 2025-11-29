// libs/platform/cloud-access/src/lib/models/cloud-storage.models.ts

export interface BackupFile {
  fileId: string;
  name: string;
  createdAt: string; // ISO Date
  sizeBytes: number;
  // Optional metadata useful for providers
  metadata?: Record<string, string>;
}

export interface CloudPermissionResult {
  granted: boolean;
  error?: string;
}
