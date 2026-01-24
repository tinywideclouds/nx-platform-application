import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  VaultProvider,
  WriteOptions,
  AssetResult,
  Visibility,
  DriveProvider,
} from '../vault.provider';
import { PlatformStorageConfig } from '../vault.tokens';
import { GOOGLE_TOKEN_STRATEGY } from './google-token.strategy';

interface GoogleFile {
  id: string;
  name: string;
  parents?: string[];
  mimeType?: string;
  thumbnailLink?: string;
}

interface GoogleFileListResponse {
  files: GoogleFile[];
}

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}
declare const gapi: any;
declare const google: any;

@Injectable()
export class GoogleDriveDriver implements VaultProvider {
  // ✅ ID matches Backend Route ('google-drive')
  readonly providerId: DriveProvider = 'google-drive';
  readonly displayName = 'Google Drive';

  private logger = inject(Logger);
  private config = inject(PlatformStorageConfig, { optional: true });
  private strategy = inject(GOOGLE_TOKEN_STRATEGY);

  private readonly DISCOVERY_DOC =
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

  // Singleton Promise to prevent double-loading scripts
  private initPromise: Promise<void> | null = null;

  // ✅ New Capabilities from your update
  readonly capabilities = {
    canDownload: true,
    canEmbed: true,
    canLinkExternal: true,
  };

  public isAuthenticated(): boolean {
    return this.strategy.isAuthenticated();
  }

  constructor() {
    if (!this.config) {
      this.logger.warn(
        '[GoogleDriveDriver] No config provided. Driver disabled.',
      );
    }
  }

  // =================================================================
  // 1. STATELESS OPERATIONS (Fast, No Auth Required or Cached)
  // =================================================================

  async getEmbedLink(resourceId: string): Promise<string> {
    return `https://drive.google.com/file/d/${resourceId}/preview`;
  }

  async getDriveLink(assetId: string, preview?: boolean): Promise<string> {
    if (!assetId) return '';
    const mode = preview ? 'preview' : 'view';
    return `https://drive.google.com/file/d/${assetId}/${mode}`;
  }

  /**
   * ✅ NEW FEATURE: Blob Download
   * Uses API Key to bypass CORS/Auth blocks for image previews.
   */
  async downloadAsset(assetId: string): Promise<string> {
    if (!assetId) return '';
    const apiKey = this.config?.googleApiKey;

    // 1. Check Browser Cache (Performance)
    const cacheName = 'drive-assets-v1';
    const requestUrl = `https://www.googleapis.com/drive/v3/files/${assetId}?alt=media&key=${apiKey}`;

    try {
      if ('caches' in window) {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(requestUrl);

        if (cachedResponse) {
          const blob = await cachedResponse.blob();
          return URL.createObjectURL(blob);
        }
      }
    } catch (e) {
      this.logger.warn('[Drive] Cache check failed', e);
    }

    // 2. Network Fetch (Uses API Key)
    try {
      const response = await fetch(requestUrl, { method: 'GET' });
      if (!response.ok) throw new Error(response.statusText);

      // 3. Store in Cache
      if ('caches' in window) {
        const cache = await caches.open(cacheName);
        cache.put(requestUrl, response.clone());
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      this.logger.error(`[Drive] Download failed`, e);
      return '';
    }
  }

  // =================================================================
  // 2. STATEFUL OPERATIONS (Auth Required)
  // =================================================================

  async link(persist: boolean): Promise<boolean> {
    if (persist) {
      await this.ensureReady();
    }
    return this.strategy.connect(persist);
  }

  async unlink(): Promise<void> {
    await this.strategy.disconnect();
  }

  async uploadAsset(
    blob: Blob,
    filename: string,
    visibility: Visibility = 'public',
    mimeType: string | undefined,
  ): Promise<AssetResult> {
    await this.ensureReady();

    const assetsFolderId = await this.resolvePath('assets', true);
    const finalMimeType = mimeType || 'application/octet-stream';

    // Uses the FIXED performResumableUpload below
    const uploadId = await this.performResumableUpload(
      blob,
      filename,
      finalMimeType,
      assetsFolderId,
    );

    this.logger.info('[Drive] Upload complete:', filename, uploadId);

    if (visibility === 'public') {
      try {
        await gapi.client.drive.permissions.create({
          fileId: uploadId,
          resource: { role: 'reader', type: 'anyone' },
        });
      } catch (e) {
        this.logger.warn('[Drive] Failed to set public permission', e);
      }
    }

    return {
      resourceId: uploadId,
      provider: 'google-drive',
    };
  }

  async writeJson(
    path: string,
    data: any,
    options?: WriteOptions,
  ): Promise<void> {
    await this.ensureReady();

    const fileName = path.split('/').pop() || 'data.json';
    const folderName = path.split('/').slice(0, -1).join('/');

    const parentId = await this.resolvePath(folderName, options?.blindCreate);
    const existing = await this.findFile(fileName, parentId);

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    await this.performResumableUpload(
      blob,
      fileName,
      'application/json',
      parentId,
      existing?.id,
    );
  }

  async readJson<T>(path: string): Promise<T | null> {
    await this.ensureReady();
    const fileName = path.split('/').pop() || '';
    const folderName = path.split('/').slice(0, -1).join('/');

    try {
      const parentId = await this.resolvePath(folderName, false);
      if (!parentId && folderName) return null;

      const file = await this.findFile(fileName, parentId);
      if (!file) return null;

      const response = await gapi.client.drive.files.get({
        fileId: file.id,
        alt: 'media',
      });

      return response.result as T;
    } catch (e) {
      this.logger.error('[Drive] Read failed', e);
      return null;
    }
  }

  async fileExists(path: string): Promise<boolean> {
    await this.ensureReady();
    const fileName = path.split('/').pop() || '';
    const folderName = path.split('/').slice(0, -1).join('/');
    const parentId = await this.resolvePath(folderName, false);
    if (!parentId && folderName) return false;

    const file = await this.findFile(fileName, parentId);
    return !!file;
  }

  async listFiles(path: string): Promise<string[]> {
    await this.ensureReady();
    try {
      const folderId = await this.resolvePath(path, false);
      if (!folderId && path) return [];

      const query = `'${folderId || 'root'}' in parents and trashed = false`;
      const response = await gapi.client.drive.files.list({
        q: query,
        fields: 'files(name)',
        pageSize: 100,
      });

      return (response.result as GoogleFileListResponse).files.map(
        (f) => f.name,
      );
    } catch (e) {
      this.logger.error('[Drive] List failed', e);
      return [];
    }
  }

  // =================================================================
  // 3. PRIVATE HELPERS
  // =================================================================

  /**
   * ✅ CRITICAL FIX: The Bridge
   * Ensures scripts are loaded AND the Strategy token is given to GAPI.
   */
  private async ensureReady(): Promise<void> {
    // 1. Load Scripts (Singleton)
    if (!this.initPromise) {
      this.initPromise = this.initializeScripts();
    }
    await this.initPromise;

    // This prevents the 404 error during app initialization.
    if (this.strategy.isAuthenticated()) {
      try {
        const token = await this.strategy.getAccessToken();
        if (token && gapi?.client) {
          gapi.client.setToken({ access_token: token });
        }
      } catch (e) {
        // Safe to ignore here; means token is expired or revoked.
      }
    }
  }

  private async initializeScripts() {
    await Promise.all([this.loadGapiScript(), this.loadGisScript()]);
    // Initialize GAPI Client
    await new Promise<void>((resolve) => {
      gapi.load('client', async () => {
        await gapi.client.init({ discoveryDocs: [this.DISCOVERY_DOC] });
        resolve();
      });
    });
    // Init Strategy if needed
    if ((this.strategy as any).init) (this.strategy as any).init();
  }

  /**
   * ✅ CRITICAL FIX: Upload Auth
   * Fetches token from Strategy directly, ignoring GAPI internal state.
   */
  private async performResumableUpload(
    blob: Blob,
    filename: string,
    mimeType: string,
    parentId?: string,
    existingFileId?: string,
  ): Promise<string> {
    // Get token from source of truth
    const accessToken = await this.strategy.getAccessToken();

    const baseUrl = 'https://www.googleapis.com/upload/drive/v3/files';
    const url = existingFileId
      ? `${baseUrl}/${existingFileId}?uploadType=resumable`
      : `${baseUrl}?uploadType=resumable`;
    const method = existingFileId ? 'PATCH' : 'POST';

    const metadata: any = { name: filename, mimeType: mimeType };
    if (parentId && !existingFileId) metadata.parents = [parentId];

    // 1. Init (Start Session)
    const initResponse = await fetch(url, {
      method: method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Length': blob.size.toString(),
        'X-Upload-Content-Type': mimeType,
      },
      body: JSON.stringify(metadata),
    });

    if (!initResponse.ok)
      throw new Error(`[Drive] Init failed: ${initResponse.statusText}`);

    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) throw new Error('[Drive] No upload location received');

    // 2. Upload (Send Bytes)
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Length': blob.size.toString() },
      body: blob,
    });

    if (!uploadResponse.ok)
      throw new Error(`[Drive] Upload failed: ${uploadResponse.statusText}`);

    const result = await uploadResponse.json();
    return result.id;
  }

  private async findFile(
    name: string,
    parentId?: string,
  ): Promise<GoogleFile | null> {
    // Helper relies on ensureReady being called upstream
    const q = [
      `name = '${name}'`,
      `trashed = false`,
      parentId ? `'${parentId}' in parents` : null,
    ]
      .filter(Boolean)
      .join(' and ');

    const resp = await gapi.client.drive.files.list({
      q,
      fields: 'files(id, name, thumbnailLink)',
      pageSize: 1,
    });
    return resp.result.files[0] || null;
  }

  private async resolvePath(
    path: string,
    createIfMissing = false,
  ): Promise<string | undefined> {
    if (!path) return undefined;
    const parts = path.split('/').filter((p) => !!p);
    let currentParentId: string | undefined = undefined;

    for (const part of parts) {
      const existing = await this.findFile(part, currentParentId);
      if (existing) {
        currentParentId = existing.id;
      } else if (createIfMissing) {
        currentParentId = await this.createFolder(part, currentParentId);
      } else {
        return undefined;
      }
    }
    return currentParentId;
  }

  private async createFolder(name: string, parentId?: string): Promise<string> {
    const metadata: any = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) metadata.parents = [parentId];
    const resp = await gapi.client.drive.files.create({
      resource: metadata,
      fields: 'id',
    });
    return resp.result.id;
  }

  // --- SCRIPT LOADERS ---
  private loadGapiScript(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if (typeof gapi !== 'undefined') return Promise.resolve();
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => resolve();
      document.body.appendChild(script);
    });
  }

  private loadGisScript(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if (typeof google !== 'undefined' && google.accounts)
      return Promise.resolve();
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => resolve();
      document.body.appendChild(script);
    });
  }
}
