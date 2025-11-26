import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import {
  CloudStorageProvider,
  CloudBackupMetadata,
  BackupPayload,
} from '../models/cloud-provider.interface';

@Injectable()
export class MockCloudProvider implements CloudStorageProvider {
  readonly providerId = 'google'; // Masquerade as Google for testing
  private logger = inject(Logger);

  // In-memory fake storage
  private mockFiles = new Map<string, BackupPayload>();
  private isAuthorized = false;

  hasPermission(): boolean {
    return this.isAuthorized;
  }

  async requestAccess(): Promise<boolean> {
    this.logger.info('[MockCloud] Requesting access... (Simulating Popup)');
    // Simulate user interaction delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    this.isAuthorized = true;
    return true;
  }

  async uploadBackup(
    payload: BackupPayload,
    filename: string
  ): Promise<CloudBackupMetadata> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const fileId = `mock-file-${crypto.randomUUID()}`;
    this.mockFiles.set(fileId, payload);

    this.logger.info(`[MockCloud] Uploaded ${filename} (${fileId})`);

    return {
      fileId,
      name: filename,
      createdAt: new Date().toISOString(),
      sizeBytes: JSON.stringify(payload).length,
    };
  }

  async listBackups(): Promise<CloudBackupMetadata[]> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Return all stored mock files
    return Array.from(this.mockFiles.entries()).map(([id, payload]) => ({
      fileId: id,
      name: `mock_backup_${id.substring(0, 8)}.json`,
      createdAt: payload.timestamp,
      sizeBytes: 1024, // Fake size
    }));
  }

  async downloadBackup(fileId: string): Promise<BackupPayload> {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const file = this.mockFiles.get(fileId);
    if (!file) {
      throw new Error('Mock file not found');
    }
    return file;
  }
}
