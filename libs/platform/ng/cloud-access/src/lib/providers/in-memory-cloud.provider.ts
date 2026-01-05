import { Injectable } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { CloudStorageProvider } from '../cloud-provider.interface';
import { BackupFile } from '../models/cloud-storage.models';

@Injectable()
export class InMemoryCloudProvider implements CloudStorageProvider {
  readonly providerId = 'in-memory';
  readonly displayName = 'Local Memory';
  private _hasPermission = false;

  // Key = Full Path (e.g. "tinywide/contacts/backup.json")
  private storage = new Map<string, string>();
  private metadata = new Map<string, BackupFile>();

  async requestAccess(scopes?: string[]): Promise<boolean> {
    this._hasPermission = true;
    return true;
  }

  hasPermission(): boolean {
    return this._hasPermission;
  }
  async revokeAccess(): Promise<void> {
    this._hasPermission = false;
  }

  async listBackups(query: string): Promise<BackupFile[]> {
    this.checkAuth();
    const results: BackupFile[] = [];
    for (const [path, meta] of this.metadata.entries()) {
      // Simple string matching to simulate search
      if (path.includes(query) || meta.name.includes(query)) {
        results.push(meta);
      }
    }
    return results;
  }

  async uploadFile<T>(data: T, path: string): Promise<void> {
    this.checkAuth();
    const content = JSON.stringify(data);
    this.storage.set(path, content);

    // Extract filename from path for metadata
    const name = path.split('/').pop() || path;

    this.metadata.set(path, {
      fileId: `id-${path}`,
      name: name,
      createdAt: Temporal.Now.instant().toString(),
      sizeBytes: content.length,
    });
  }

  async downloadFile<T>(path: string): Promise<T | null> {
    this.checkAuth();
    // Simulate path resolution: direct lookup
    const content = this.storage.get(path);
    if (!content) return null;
    return JSON.parse(content) as T;
  }

  // Alias for generic backup methods
  async uploadBackup(data: any, path: string): Promise<void> {
    return this.uploadFile(data, path);
  }

  async downloadBackup<T>(fileId: string): Promise<T> {
    this.checkAuth();
    // Reverse lookup (Mock logic: fileId is "id-" + path)
    const path = fileId.replace('id-', '');
    const content = this.storage.get(path);
    if (!content) throw new Error('File not found');
    return JSON.parse(content) as T;
  }

  private checkAuth() {
    if (!this._hasPermission) throw new Error('Access Denied');
  }
}
