import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { CloudStorageProvider } from '../cloud-provider.interface';
import { BackupFile } from '../models/cloud-storage.models';
import { PLATFORM_CLOUD_CONFIG } from '../tokens/cloud-config.token';

declare const google: any;

@Injectable()
export class GoogleDriveService implements CloudStorageProvider {
  readonly providerId = 'google';
  readonly displayName = 'Google Drive';

  private logger = inject(Logger);
  private config = inject(PLATFORM_CLOUD_CONFIG, { optional: true });

  private readonly SCOPE = 'https://www.googleapis.com/auth/drive.file';
  private tokenClient: any;
  private accessToken: string | null = null;

  // Cache completed Folder IDs
  private folderCache = new Map<string, string>();

  // Cache in-flight Promises to prevent Race Conditions (Duplicate Folders)
  private folderPromises = new Map<string, Promise<string>>();

  constructor() {
    if (!this.config?.googleClientId) {
      this.logger.warn(
        '[GoogleDrive] No Client ID provided. Service disabled.'
      );
    } else {
      this.initializeGoogleIdentityClient();
    }
  }

  // --- Auth Logic ---
  private initializeGoogleIdentityClient(): void {
    if (typeof google === 'undefined' || !this.config?.googleClientId) return;
    try {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.config.googleClientId,
        scope: this.SCOPE,
        callback: (tokenResponse: any) => {
          if (tokenResponse.access_token)
            this.accessToken = tokenResponse.access_token;
        },
      });
    } catch (e) {
      this.logger.error('[GoogleDrive] Failed to init token client', e);
    }
  }

  hasPermission(): boolean {
    if (!this.accessToken || typeof google === 'undefined') return false;
    return google.accounts.oauth2.hasGrantedAllScopes(
      { access_token: this.accessToken, scope: this.SCOPE },
      this.SCOPE
    );
  }

  /**
   * Request Access with Dynamic Scopes
   */
  async requestAccess(): Promise<boolean> {
    if (!this.tokenClient) this.initializeGoogleIdentityClient();
    if (!this.tokenClient) return false;

    // FIX: Short-circuit if we already have permission.
    // This prevents a second (blocked) popup from triggering
    // when services call connect() multiple times in one flow.
    if (this.hasPermission()) {
      return true;
    }

    return new Promise((resolve) => {
      this.tokenClient.callback = (resp: any) => {
        if (resp.error) {
          resolve(false);
          return;
        }
        this.accessToken = resp.access_token;
        resolve(google.accounts.oauth2.hasGrantedAllScopes(resp, this.SCOPE));
      };
      // Only prompt if we actually need a new token
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  async revokeAccess(): Promise<void> {
    if (this.accessToken && typeof google !== 'undefined') {
      google.accounts.oauth2.revoke(this.accessToken, () => {
        this.logger.info('[GoogleDrive] Access revoked.');
      });
      this.accessToken = null;
      this.folderCache.clear();
      this.folderPromises.clear();
    }
  }

  // --- Operations (Unchanged) ---

  async uploadFile<T>(data: T, filepath: string): Promise<void> {
    await this.performUpload(data, filepath);
  }

  async uploadBackup(content: unknown, filepath: string): Promise<void> {
    await this.performUpload(content, filepath);
  }

  async downloadFile<T>(filepath: string): Promise<T | null> {
    const parts = filepath.split('/');
    const filename = parts.pop()!;
    const folderPath = parts;

    // Use false to NOT create folders on download
    const parentId = await this.resolveParentFolderId(folderPath, false);

    if (!parentId && folderPath.length > 0) return null;

    const files = await this.listFilesByNameAndParent(
      filename,
      parentId || 'root'
    );

    if (files.length === 0) return null;
    return this.downloadBackup<T>(files[0].id);
  }

  async downloadBackup<T = unknown>(fileId: string): Promise<T> {
    if (!this.accessToken) throw new Error('No access token available.');

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );

    if (!response.ok) throw new Error('Failed to download backup file');
    return await response.json();
  }

  async listBackups(querySubstring?: string): Promise<BackupFile[]> {
    if (!this.accessToken) throw new Error('No access token available.');

    let query =
      'trashed = false and mimeType != "application/vnd.google-apps.folder"';

    if (querySubstring) {
      const safeSubstring = querySubstring.replace(/'/g, "\\'");
      query += ` and name contains '${safeSubstring}'`;
    }

    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.append('q', query);
    url.searchParams.append('fields', 'files(id, name, size, createdTime)');
    url.searchParams.append('orderBy', 'createdTime desc');

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) throw new Error('Failed to list backups');

    const data = await response.json();
    return (data.files || []).map((f: any) => ({
      fileId: f.id,
      name: f.name,
      createdAt: f.createdTime,
      sizeBytes: parseInt(f.size, 10),
    }));
  }

  // --- Internal Implementation ---

  private async performUpload(
    content: unknown,
    filepath: string
  ): Promise<void> {
    if (!this.accessToken) throw new Error('No access token available.');

    const parts = filepath.split('/');
    const filename = parts.pop()!;
    const folderPath = parts;

    // Resolve Parent with Locking
    const parentId = await this.resolveParentFolderId(folderPath, true);

    let fileBody: Blob | string;
    let mimeType = 'application/json';

    if (content instanceof Blob) {
      fileBody = content;
      mimeType = content.type || 'application/octet-stream';
    } else if (typeof content === 'string') {
      fileBody = content;
      mimeType =
        content.trim().startsWith('{') || content.trim().startsWith('[')
          ? 'application/json'
          : 'text/plain';
    } else {
      fileBody = JSON.stringify(content);
      mimeType = 'application/json';
    }

    const existingFiles = await this.listFilesByNameAndParent(
      filename,
      parentId || 'root'
    );
    const fileIdToUpdate =
      existingFiles.length > 0 ? existingFiles[0].id : null;

    const metadata: any = { name: filename, mimeType };
    if (parentId && !fileIdToUpdate) {
      metadata.parents = [parentId];
    }

    const form = new FormData();
    const method = fileIdToUpdate ? 'PATCH' : 'POST';
    const endpoint = fileIdToUpdate
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileIdToUpdate}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';

    if (fileIdToUpdate) delete metadata.parents;

    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );

    const contentBlob =
      fileBody instanceof Blob
        ? fileBody
        : new Blob([fileBody], { type: mimeType });
    form.append('file', contentBlob);

    this.logger.debug(
      `[GoogleDrive] ${method} ${filename} in ${parentId || 'root'}...`
    );

    const response = await fetch(endpoint, {
      method: method,
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form,
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`[GoogleDrive] Upload failed: ${err}`);
      throw new Error('Google Drive upload failed');
    }
  }

  // --- Locking Implementation ---

  private async resolveParentFolderId(
    folders: string[],
    createIfMissing: boolean
  ): Promise<string | undefined> {
    if (folders.length === 0) return undefined; // Root

    let currentParentId = 'root';

    for (const folderName of folders) {
      const cacheKey = `${currentParentId}/${folderName}`;

      if (this.folderCache.has(cacheKey)) {
        currentParentId = this.folderCache.get(cacheKey)!;
        continue;
      }

      if (this.folderPromises.has(cacheKey)) {
        currentParentId = await this.folderPromises.get(cacheKey)!;
        continue;
      }

      const folderPromise = this.findOrCreateFolder(
        folderName,
        currentParentId,
        createIfMissing
      );

      this.folderPromises.set(cacheKey, folderPromise);

      try {
        const folderId = await folderPromise;
        if (!folderId && !createIfMissing) return undefined;
        if (folderId) {
          this.folderCache.set(cacheKey, folderId);
          currentParentId = folderId;
        }
      } finally {
        this.folderPromises.delete(cacheKey);
      }
    }

    return currentParentId;
  }

  private async findOrCreateFolder(
    name: string,
    parentId: string,
    create: boolean
  ): Promise<string> {
    const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${name}' and '${parentId}' in parents and trashed = false`;
    const files = await this.runQuery(query);

    if (files.length > 0) {
      return files[0].id;
    }

    if (!create) return '';

    this.logger.info(`[GoogleDrive] Creating folder: ${name} in ${parentId}`);
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create folder ${name}`);
    }

    const createData = await createRes.json();
    return createData.id;
  }

  private async listFilesByNameAndParent(
    name: string,
    parentId: string
  ): Promise<any[]> {
    const query = `name = '${name}' and '${parentId}' in parents and trashed = false`;
    return this.runQuery(query);
  }

  private async runQuery(query: string): Promise<any[]> {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.append('q', query);
    url.searchParams.append('fields', 'files(id, name)');
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const data = await res.json();
    return data.files || [];
  }
}
