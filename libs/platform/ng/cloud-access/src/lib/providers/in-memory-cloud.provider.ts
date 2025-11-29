// libs/platform/cloud-access/src/lib/providers/in-memory-cloud.provider.ts

import { Injectable } from '@angular/core';
import { CloudStorageProvider } from '../cloud-provider.interface';
import { BackupFile } from '../models/cloud-storage.models';

/**
 * A volatile in-memory cloud provider for testing and development.
 * Simulates network latency and storage operations.
 */
@Injectable()
export class InMemoryCloudProvider implements CloudStorageProvider {
  readonly providerId = 'in-memory';
  readonly displayName = 'Local Memory (Dev)';

  private _hasPermission = false;

  // The "Cloud" Storage
  // Key = Filename, Value = JSON String
  private storage = new Map<string, string>();

  // File Metadata
  private metadata = new Map<string, BackupFile>();

  async requestAccess(): Promise<boolean> {
    this._hasPermission = true;
    return true;
  }

  hasPermission(): boolean {
    return this._hasPermission;
  }

  async revokeAccess(): Promise<void> {
    this._hasPermission = false;
  }

  async listBackups(prefix: string): Promise<BackupFile[]> {
    this.checkAuth();
    // Simulate Network Latency
    await this.delay(200);

    const results: BackupFile[] = [];
    for (const [name, meta] of this.metadata.entries()) {
      if (name.startsWith(prefix)) {
        results.push(meta);
      }
    }
    return results;
  }

  async uploadFile<T>(data: T, filename: string): Promise<void> {
    this.checkAuth();
    await this.delay(300);

    const content = JSON.stringify(data);
    this.storage.set(filename, content);

    // Update Metadata
    this.metadata.set(filename, {
      fileId: `id-${filename}`, // Simple mock ID
      name: filename,
      createdAt: new Date().toISOString(),
      sizeBytes: content.length,
    });
  }

  async downloadFile<T>(filename: string): Promise<T | null> {
    this.checkAuth();
    await this.delay(200);

    const content = this.storage.get(filename);
    if (!content) return null;

    return JSON.parse(content) as T;
  }

  // For InMemory, Backup/File logic is identical (no compression)
  async uploadBackup(data: any, filename: string): Promise<void> {
    return this.uploadFile(data, filename);
  }

  async downloadBackup<T>(fileId: string): Promise<T> {
    this.checkAuth();
    await this.delay(200);

    // Reverse lookup ID -> Filename (Mock logic)
    const filename = fileId.replace('id-', '');
    const content = this.storage.get(filename);

    if (!content) throw new Error(`File not found: ${fileId}`);
    return JSON.parse(content) as T;
  }

  // --- Helpers ---

  private checkAuth() {
    if (!this._hasPermission) throw new Error('Cloud Access Denied');
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
