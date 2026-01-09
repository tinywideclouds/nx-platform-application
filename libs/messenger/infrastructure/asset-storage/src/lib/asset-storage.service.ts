import { Injectable, inject } from '@angular/core';
import { StorageService } from '@nx-platform-application/platform-domain-storage';

@Injectable({ providedIn: 'root' })
export class AssetStorageService {
  private platformStorage = inject(StorageService);

  /**
   * Uploads a media asset to the Cloud Storage.
   *
   * ARCHITECTURE NOTE:
   * This is designed to be "Feed Ready".
   * The returned URL is a public/accessible link that can be used inside
   * the Chat UI now, but could be rendered in a "Social Feed" view later.
   */
  async upload(file: File): Promise<string> {
    // 1. Guard: Connect to the Vault
    if (!this.platformStorage.isConnected()) {
      throw new Error(
        'No cloud storage provider connected. Please connect a drive in Settings.',
      );
    }

    // 2. Naming Strategy
    // We might want to organize these better later (e.g., /assets/2024/01/...)
    // For now, the Platform Storage handles the collision logic.
    const filename = file.name;

    // 3. Delegate to Platform
    // This utilizes the existing Auth/Session of the connected Drive.
    return this.platformStorage.uploadPublicAsset(file, filename);
  }
}
