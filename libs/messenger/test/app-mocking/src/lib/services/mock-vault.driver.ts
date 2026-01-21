import { Injectable } from '@angular/core';
import {
  VaultProvider,
  WriteOptions,
  AssetResult,
  Visibility,
} from '@nx-platform-application/platform-infrastructure-storage';

@Injectable()
export class MockVaultDriver implements VaultProvider {
  readonly providerId = 'mock-drive';
  readonly displayName = 'Mock Storage';

  // In-memory "Cloud"
  private fileSystem = new Map<string, any>();
  private authenticated = false;

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  async link(persist: boolean): Promise<boolean> {
    console.log('[MockVault] 🔗 Linking "Mock" Account...');
    this.authenticated = true;
    return true;
  }

  async unlink(): Promise<void> {
    console.log('[MockVault] 🔌 Unlinking...');
    this.authenticated = false;
  }

  // --- DATA PLANE: JSON ---

  async writeJson(
    path: string,
    data: unknown,
    options?: WriteOptions,
  ): Promise<void> {
    console.log(`[MockVault] 💾 Writing JSON to "${path}"`, data);
    this.fileSystem.set(path, JSON.parse(JSON.stringify(data))); // Clone
  }

  async readJson<T>(path: string): Promise<T | null> {
    const data = this.fileSystem.get(path);
    if (!data) return null;
    return JSON.parse(JSON.stringify(data)) as T;
  }

  async fileExists(path: string): Promise<boolean> {
    return this.fileSystem.has(path);
  }

  async listFiles(directory: string): Promise<string[]> {
    // Simple mock implementation: verify key starts with directory
    return Array.from(this.fileSystem.keys())
      .filter((k) => k.startsWith(directory))
      .map((k) => k.split('/').pop() || k);
  }

  // --- DATA PLANE: ASSETS ---

  async uploadAsset(
    blob: Blob,
    filename: string,
    visibility: Visibility,
    mimeType: string | undefined,
  ): Promise<AssetResult> {
    const id = `mock-asset-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[MockVault] 📸 Uploading Asset "${filename}" -> ID: ${id}`);

    // Store dummy ref
    this.fileSystem.set(`assets/${id}`, { blob, mimeType });

    return {
      resourceId: id,
      provider: 'google-drive', // Pretend to be Google for compatibility
    };
  }

  async getDriveLink(assetId: string, preview?: boolean): Promise<string> {
    return `https://mock-drive.local/preview/${assetId}`;
  }

  async downloadAsset(assetId: string): Promise<string> {
    // Return a dummy placeholder image for all downloads
    // This ensures <img> tags get a valid source
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  }
}
