import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import {
  VaultProvider,
  WriteOptions,
  AssetResult,
  Visibility,
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
  readonly providerId = 'google';
  readonly displayName = 'Google Drive';

  private logger = inject(Logger);
  private config = inject(PlatformStorageConfig, { optional: true });
  private strategy = inject(GOOGLE_TOKEN_STRATEGY);

  private readonly DISCOVERY_DOC =
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

  public isAuthenticated(): boolean {
    return this.strategy.isAuthenticated();
  }

  constructor() {
    if (!this.config) {
      this.logger.warn(
        '[GoogleDriveDriver] No config provided. Driver disabled.',
      );
      return;
    }
    this.initializeScripts();
  }

  async link(persist: boolean): Promise<boolean> {
    return this.strategy.connect(persist);
  }

  async unlink(): Promise<void> {
    await this.strategy.disconnect();
  }

  // =================================================================
  // 1. DATA PLANE: BINARY ASSETS (IMAGES/VIDEOS)
  // =================================================================

  async uploadAsset(
    blob: Blob,
    filename: string,
    visibility: Visibility = 'public',
    mimeType: string | undefined,
  ): Promise<AssetResult> {
    await this.ensureReady();

    // 1. Resolve folder
    const assetsFolderId = await this.resolvePath('assets', true);

    // Default to binary if no mimeType provided
    const finalMimeType = mimeType || 'application/octet-stream';

    const uploadId = await this.performResumableUpload(
      blob,
      filename,
      finalMimeType,
      assetsFolderId,
    );

    this.logger.info('[Drive] Set got upload id:', filename, uploadId);

    if (visibility === 'public') {
      // 2. Mark as Public (Required for API Key access later)
      const permissions = await gapi.client.drive.permissions.create({
        fileId: uploadId,
        resource: { role: 'reader', type: 'anyone' },
      });
      this.logger.debug('[Drive] Set public read permissions:', permissions);
    }

    // 3. Return standard result (IDs only)
    return {
      resourceId: uploadId,
      provider: 'google-drive',
    };
  }

  /**
   * Generates the interaction URL based on the requested mode.
   * - Preview: Embeddable iframe URL
   * - Standard: Full web viewer URL
   */
  async getDriveLink(assetId: string, preview?: boolean): Promise<string> {
    if (!assetId) return '';
    // /preview = Iframe-friendly "clean" viewer
    // /view = Standard Google Drive UI
    const mode = preview ? 'preview' : 'view';
    return `https://drive.google.com/file/d/${assetId}/${mode}`;
  }

  /**
   * Downloads the raw asset data using the API Key (No User Auth required).
   * This bypasses 403s on "Hotlinking" by acting as an API fetch.
   */
  async downloadAsset(assetId: string): Promise<string> {
    if (!assetId) return '';
    const apiKey = this.config?.googleApiKey;

    // 1. Check if we have a valid cache in the Browser's "Cache Storage"
    const cacheName = 'drive-assets-v1';
    const requestUrl = `https://www.googleapis.com/drive/v3/files/${assetId}?alt=media&key=${apiKey}`;

    // Try cache first
    try {
      if ('caches' in window) {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(requestUrl);

        if (cachedResponse) {
          // HIT: Serve instantly from disk.
          const blob = await cachedResponse.blob();
          return URL.createObjectURL(blob);
        }
      }
    } catch (e) {
      this.logger.warn('[Drive] Cache check failed', e);
    }

    // 2. MISS: Fetch from network
    try {
      const response = await fetch(requestUrl, { method: 'GET' });
      if (!response.ok) throw new Error(response.statusText);

      // 3. Clone and Store in Cache for next time
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
  // 2. DATA PLANE: JSON STRUCTURES
  // =================================================================

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

  // =================================================================
  // 3. CONTROL PLANE
  // =================================================================

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

      let query = `'${folderId || 'root'}' in parents and trashed = false`;
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
  // 4. PRIVATE HELPERS
  // =================================================================

  private async performResumableUpload(
    blob: Blob,
    filename: string,
    mimeType: string,
    parentId?: string,
    existingFileId?: string,
  ): Promise<string> {
    // console.log('Performing resumable upload to Google Drive:');
    // Commented out to reduce noise, usually better to stick to logger

    const accessToken = gapi.client.getToken().access_token;
    const baseUrl = 'https://www.googleapis.com/upload/drive/v3/files';
    const url = existingFileId
      ? `${baseUrl}/${existingFileId}?uploadType=resumable`
      : `${baseUrl}?uploadType=resumable`;
    const method = existingFileId ? 'PATCH' : 'POST';

    const metadata: any = { name: filename, mimeType: mimeType };
    if (parentId && !existingFileId) metadata.parents = [parentId];

    // 1. Init
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

    // 2. Upload
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

  private async ensureReady() {
    if (!gapi?.client) await this.initializeScripts();
    const token = await this.strategy.getAccessToken();
    gapi.client.setToken({ access_token: token });
  }

  private async initializeScripts() {
    await Promise.all([this.loadGapiScript(), this.loadGisScript()]);
    if ((this.strategy as any).init) (this.strategy as any).init();
  }

  private async findFile(
    name: string,
    parentId?: string,
  ): Promise<GoogleFile | null> {
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

  private loadGapiScript(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    return new Promise((resolve) => {
      if (typeof gapi !== 'undefined') {
        this.initGapiClient(resolve);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => this.initGapiClient(resolve);
      document.body.appendChild(script);
    });
  }

  private initGapiClient(resolve: () => void) {
    gapi.load('client', async () => {
      await gapi.client.init({ discoveryDocs: [this.DISCOVERY_DOC] });
      resolve();
    });
  }

  private loadGisScript(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    return new Promise((resolve) => {
      if (typeof google !== 'undefined' && google.accounts) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => resolve();
      document.body.appendChild(script);
    });
  }
}
