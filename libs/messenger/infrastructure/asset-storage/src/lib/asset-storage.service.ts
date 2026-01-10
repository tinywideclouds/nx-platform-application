import { Injectable, inject } from '@angular/core';
import { StorageService } from '@nx-platform-application/platform-domain-storage';

@Injectable({ providedIn: 'root' })
export class AssetStorageService {
  private platformStorage = inject(StorageService);

  /**
   * Uploads a media asset to the Cloud Storage.
   */
  async upload(file: File): Promise<string> {
    // 1. Guard: Connect to the Vault
    if (!this.platformStorage.isConnected()) {
      throw new Error(
        'No cloud storage provider connected. Please connect a drive in Settings.',
      );
    }

    const filename = file.name;

    // 2. MIME Reinforcement (The "Garbage Text" Fix)
    // Browsers can sometimes lose the 'type' or default to octet-stream during transfer.
    // We strictly recreate the File object with the correct type.
    const explicitFile = new File([file], filename, { type: file.type });

    // 3. Upload with Explicit Type
    // We pass the type as a 3rd argument (if supported) and use the reinforced object.
    return this.platformStorage.uploadPublicAsset(
      explicitFile,
      filename,
      file.type, // Explicit Content-Type
    );
  }
}
