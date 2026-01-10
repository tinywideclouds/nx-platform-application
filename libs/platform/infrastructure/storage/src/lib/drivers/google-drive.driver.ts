import { Injectable, inject, signal } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { VaultProvider, WriteOptions } from '../vault.provider';
import { PlatformStorageConfig } from '../vault.tokens';

// --- STRICT GOOGLE TYPES ---
interface GoogleFile {
  id: string;
  name: string;
  parents?: string[];
  mimeType?: string;
  webViewLink?: string;
}

interface GoogleFileListResponse {
  nextPageToken?: string;
  files: GoogleFile[];
}

interface GoogleTokenResponse {
  access_token: string;
  error?: string;
  expires_in?: number;
}

interface GoogleTokenClient {
  callback: (resp: GoogleTokenResponse) => void;
  requestAccessToken: (opts: { prompt: string }) => void;
}

// Global scope declarations
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

  // State
  private _isAuthenticated = signal(false);
  private tokenClient: GoogleTokenClient | null = null;

  // Initialization Promises
  private gapiLoadedPromise: Promise<void>;
  private gisLoadedPromise: Promise<void>;

  // Constants
  private readonly DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  private readonly DISCOVERY_DOC =
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  // REFACTOR: Renamed from 'Messenger_Public_Assets' to be generic
  private readonly ASSET_FOLDER = 'Public_Assets';
  private readonly BOUNDARY = 'foo_bar_baz';

  constructor() {
    // Initialize promises immediately to catch early load events
    this.gapiLoadedPromise = this.loadGapiScript();
    this.gisLoadedPromise = this.loadGisScript();

    // NEW: Attempt to restore session once scripts are loaded
    this.checkExistingSession();
  }

  // --- AUTHENTICATION ---

  isAuthenticated(): boolean {
    return this._isAuthenticated();
  }

  async link(persist: boolean): Promise<boolean> {
    if (!this.config?.googleClientId) {
      this.logger.error('[GoogleDrive] Missing googleClientId configuration.');
      return false;
    }

    try {
      // 1. Ensure scripts are loaded
      await Promise.all([this.gapiLoadedPromise, this.gisLoadedPromise]);

      // 2. Initialize Token Client if needed
      if (!this.tokenClient) {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: this.config.googleClientId,
          scope: this.DRIVE_SCOPE,
          callback: () => {}, // Will be overridden below
        });
      }

      // 3. Request Token
      return new Promise((resolve) => {
        if (!this.tokenClient) return resolve(false);

        // Override callback to capture the result of this specific request
        this.tokenClient.callback = (resp: GoogleTokenResponse) => {
          if (resp.error) {
            this.logger.error(`[GoogleDrive] Auth Error: ${resp.error}`);
            resolve(false);
            return;
          }
          this._isAuthenticated.set(true);
          resolve(true);
        };

        // Trigger Popup
        // If persist is requested, we might want to store a hint,
        // but GIS mainly manages the token in memory/cookie.
        this.tokenClient.requestAccessToken({ prompt: '' });
      });
    } catch (e) {
      this.logger.error('[GoogleDrive] Link Failed', e);
      return false;
    }
  }

  async unlink(): Promise<void> {
    if (typeof gapi !== 'undefined' && gapi.client) {
      const token = gapi.client.getToken();
      if (token) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken(null);
      }
    }
    this._isAuthenticated.set(false);
  }

  // --- STORAGE IMPLEMENTATION ---

  async writeJson(
    path: string,
    data: unknown,
    options?: WriteOptions,
  ): Promise<void> {
    this.ensureAuth();

    const { filename, folderPath } = this.parsePath(path);
    const parentId = await this.ensureFolderHierarchy(folderPath);
    const content = JSON.stringify(data, null, 2);

    let existingId: string | null = null;

    // Optimization: Skip existence check if 'blindCreate' is true
    if (!options?.blindCreate) {
      existingId = await this.getFileIdByName(filename, parentId);
    }

    if (existingId) {
      await this.updateFile(existingId, content);
    } else {
      await this.createFile(filename, parentId, content);
    }
  }

  async readJson<T>(path: string): Promise<T | null> {
    this.ensureAuth();

    const { filename, folderPath } = this.parsePath(path);
    const parentId = await this.findFolderId(folderPath);

    if (!parentId) {
      this.logger.warn(
        `[GoogleDrive] Read failed: Parent folder not found for ${path}`,
      );
      return null;
    }

    const fileId = await this.getFileIdByName(filename, parentId);
    if (!fileId) return null;

    try {
      const response = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });
      // UPDATE: Handle potential response structure variations
      return (response.result || response.body) as T;
    } catch (e) {
      this.logger.error(`[GoogleDrive] Failed to read file: ${filename}`, e);
      return null;
    }
  }

  async fileExists(path: string): Promise<boolean> {
    this.ensureAuth();
    const { filename, folderPath } = this.parsePath(path);

    const parentId = await this.findFolderId(folderPath);
    if (!parentId) return false;

    const fileId = await this.getFileIdByName(filename, parentId);
    return !!fileId;
  }

  async listFiles(directory: string): Promise<string[]> {
    this.ensureAuth();
    const parentId = await this.findFolderId(directory);
    if (!parentId) return [];

    const q = `'${parentId}' in parents and trashed = false`;
    let files: GoogleFile[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const res: { result: GoogleFileListResponse } =
        await gapi.client.drive.files.list({
          q,
          fields: 'nextPageToken, files(name)',
          pageToken,
        });

      if (res.result.files) {
        files = files.concat(res.result.files);
      }
      pageToken = res.result.nextPageToken;
    } while (pageToken);

    return files.map((f) => f.name);
  }

  // ✅ UPDATE: Accepts contentType to fix binary uploads
  async uploadPublicAsset(
    blob: Blob,
    filename: string,
    contentType = 'application/octet-stream',
  ): Promise<string> {
    this.ensureAuth();
    const parentId = await this.ensureFolderHierarchy(this.ASSET_FOLDER);
    const base64Content = await this.blobToBase64(blob);

    const metadata = { name: filename, parents: [parentId] };
    // Pass contentType to the body generator
    const body = this.createMultipartBody(
      metadata,
      base64Content,
      true,
      contentType,
    );

    const response = await gapi.client.request({
      path: '/upload/drive/v3/files?uploadType=multipart',
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': `multipart/related; boundary=${this.BOUNDARY}`,
      },
    });

    const fileId = response.result.id;

    // Set permission to "Public Reader"
    await gapi.client.drive.permissions.create({
      fileId: fileId,
      resource: { role: 'reader', type: 'anyone' },
    });

    // Retrieve the Web View Link
    const fileInfo = await gapi.client.drive.files.get({
      fileId: fileId,
      fields: 'webViewLink',
    });

    return fileInfo.result.webViewLink;
  }

  // --- INTERNAL HELPERS ---

  private async checkExistingSession() {
    try {
      await Promise.all([this.gapiLoadedPromise, this.gisLoadedPromise]);
      // Check if GAPI client has a token loaded
      const token = gapi.client.getToken();
      if (token) {
        this._isAuthenticated.set(true);
      }
    } catch (e) {
      // Silent fail on auto-login check
    }
  }

  private ensureAuth() {
    if (!this._isAuthenticated()) {
      throw new Error('[GoogleDrive] Operation failed: Not authenticated');
    }
  }

  private parsePath(path: string) {
    const parts = path.split('/');
    const filename = parts.pop()!;
    const folderPath = parts.join('/');
    return { filename, folderPath };
  }

  private async ensureFolderHierarchy(path: string): Promise<string> {
    const parts = path.split('/').filter((p) => !!p);
    let currentId = 'root';

    for (const part of parts) {
      const existingId = await this.getFileIdByName(part, currentId, true);
      if (existingId) {
        currentId = existingId;
      } else {
        try {
          currentId = await this.createFolder(part, currentId);
        } catch (e) {
          const raceId = await this.getFileIdByName(part, currentId, true);
          if (raceId) {
            currentId = raceId;
          } else {
            throw e;
          }
        }
      }
    }
    return currentId;
  }

  private async findFolderId(path: string): Promise<string | null> {
    if (!path) return 'root';
    const parts = path.split('/').filter((p) => !!p);
    let currentId = 'root';

    for (const part of parts) {
      const existingId = await this.getFileIdByName(part, currentId, true);
      if (!existingId) return null;
      currentId = existingId;
    }
    return currentId;
  }

  private async getFileIdByName(
    name: string,
    parentId: string,
    isFolder = false,
  ): Promise<string | null> {
    let q = `name = '${name}' and '${parentId}' in parents and trashed = false`;
    if (isFolder) {
      q += ` and mimeType = 'application/vnd.google-apps.folder'`;
    }

    const res = await gapi.client.drive.files.list({
      q,
      fields: 'files(id)',
      pageSize: 1,
    });

    return res.result.files?.[0]?.id || null;
  }

  private async createFolder(name: string, parentId: string): Promise<string> {
    const metadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    };

    const res = await gapi.client.drive.files.create({
      resource: metadata,
      fields: 'id',
    });
    return res.result.id;
  }

  private async updateFile(fileId: string, content: string): Promise<void> {
    await gapi.client.request({
      path: `/upload/drive/v3/files/${fileId}?uploadType=media`,
      method: 'PATCH',
      body: content,
    });
  }

  private async createFile(
    name: string,
    parentId: string,
    content: string,
  ): Promise<string> {
    const metadata = { name: name, parents: [parentId] };
    const body = this.createMultipartBody(metadata, content);

    const response = await gapi.client.request({
      path: '/upload/drive/v3/files?uploadType=multipart',
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': `multipart/related; boundary=${this.BOUNDARY}`,
      },
    });
    return response.result.id;
  }

  // ✅ UPDATE: Correctly uses contentType for the file body part
  private createMultipartBody(
    metadata: any,
    content: string,
    isBase64 = false,
    contentType = 'application/json',
  ): string {
    const delimiter = `\r\n--${this.BOUNDARY}\r\n`;
    const close_delim = `\r\n--${this.BOUNDARY}--`;

    return (
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      (isBase64 ? 'Content-Transfer-Encoding: base64\r\n' : '') +
      `Content-Type: ${contentType}\r\n\r\n` + // <--- FIXED
      content +
      close_delim
    );
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // --- SCRIPT LOADING ---

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
