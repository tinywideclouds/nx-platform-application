// libs/platform/ng/cloud-access/src/lib/providers/google-drive.service.ts

import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { CloudStorageProvider } from '../cloud-provider.interface';
import { BackupFile } from '../models/cloud-storage.models'; // ✅ FIXED: New Model Import
import { PLATFORM_CLOUD_CONFIG } from '../tokens/cloud-config.token';

declare const google: any;

@Injectable()
export class GoogleDriveService implements CloudStorageProvider {
  readonly providerId = 'google';
  readonly displayName = 'Google Drive'; // ✅ FIXED: Required by Interface

  private logger = inject(Logger);
  private config = inject(PLATFORM_CLOUD_CONFIG, { optional: true });

  private readonly SCOPE = 'https://www.googleapis.com/auth/drive.file';
  private tokenClient: any;
  private accessToken: string | null = null;

  constructor() {
    if (!this.config?.googleClientId) {
      this.logger.warn(
        '[GoogleDrive] No Client ID provided. Service disabled.'
      );
    } else {
      this.initializeGoogleIdentityClient();
    }
  }

  // --- Auth Logic (Existing) ---

  private initializeGoogleIdentityClient(): void {
    if (typeof google === 'undefined') {
      this.logger.warn(
        '[GoogleDrive] Google Identity Services script not loaded.'
      );
      return;
    }
    if (!this.config?.googleClientId) return;

    try {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.config.googleClientId,
        scope: this.SCOPE,
        callback: (tokenResponse: any) => {
          if (tokenResponse.access_token) {
            this.accessToken = tokenResponse.access_token;
            this.logger.debug(
              '[GoogleDrive] Access token received via init callback'
            );
          }
        },
      });
    } catch (e) {
      this.logger.error('[GoogleDrive] Failed to init token client', e);
    }
  }

  hasPermission(): boolean {
    if (!this.accessToken || typeof google === 'undefined') {
      return false;
    }
    return google.accounts.oauth2.hasGrantedAllScopes(
      { access_token: this.accessToken, scope: this.SCOPE },
      this.SCOPE
    );
  }

  async requestAccess(): Promise<boolean> {
    if (!this.tokenClient) {
      this.initializeGoogleIdentityClient();
      if (!this.tokenClient) {
        this.logger.error('[GoogleDrive] Failed to initialize token client.');
        return false;
      }
    }

    return new Promise((resolve) => {
      this.tokenClient.callback = (resp: any) => {
        if (resp.error !== undefined) {
          this.logger.error(`[GoogleDrive] Auth Error: ${resp.error}`);
          resolve(false);
          return;
        }
        this.accessToken = resp.access_token;
        const granted = google.accounts.oauth2.hasGrantedAllScopes(
          resp,
          this.SCOPE
        );
        resolve(granted);
      };
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  async revokeAccess(): Promise<void> {
    // ✅ FIXED: Required by Interface
    if (this.accessToken && typeof google !== 'undefined') {
      google.accounts.oauth2.revoke(this.accessToken, () => {
        this.logger.info('[GoogleDrive] Access revoked.');
      });
      this.accessToken = null;
    }
  }

  // --- Generic File Operations (New for Twin-File Strategy) ---

  /**
   * ✅ FIXED: Generic Upload for Manifests & Indexes
   */
  async uploadFile<T>(data: T, filename: string): Promise<void> {
    await this.performUpload(data, filename);
  }

  /**
   * ✅ FIXED: Generic Download for Manifests & Indexes
   */
  async downloadFile<T>(filename: string): Promise<T | null> {
    // 1. Search for file by name
    const files = await this.listBackups(filename);
    const exactMatch = files.find((f) => f.name === filename);

    if (!exactMatch) return null;

    // 2. Download content
    return this.downloadBackup<T>(exactMatch.fileId);
  }

  // --- Domain Specific Operations (Vaults) ---

  async uploadBackup(content: unknown, filename: string): Promise<void> {
    // For Google Drive, Logic is identical to generic upload
    await this.performUpload(content, filename);
  }

  async downloadBackup<T = unknown>(fileId: string): Promise<T> {
    if (!this.accessToken) {
      throw new Error('No access token available. Request access first.');
    }

    this.logger.debug(`[GoogleDrive] Downloading file ${fileId}...`);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download backup file');
    }

    return await response.json();
  }

  async listBackups(querySubstring?: string): Promise<BackupFile[]> {
    if (!this.accessToken) {
      throw new Error('No access token available. Request access first.');
    }

    let query = 'trashed = false';
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

    if (!response.ok) {
      throw new Error('Failed to list backups from Google Drive');
    }

    const data = await response.json();
    return (data.files || []).map((f: any) => ({
      fileId: f.id,
      name: f.name,
      createdAt: f.createdTime,
      sizeBytes: parseInt(f.size, 10),
    }));
  }

  // --- Internal Helper ---

  private async performUpload(
    content: unknown,
    filename: string
  ): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available. Request access first.');
    }

    let fileBody: Blob | string;
    let mimeType = 'application/json';

    if (content instanceof Blob) {
      fileBody = content;
      mimeType = content.type || 'application/octet-stream';
    } else if (typeof content === 'string') {
      fileBody = content;
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        mimeType = 'application/json';
      } else {
        mimeType = 'text/plain';
      }
    } else {
      fileBody = JSON.stringify(content);
      mimeType = 'application/json';
    }

    const metadata = { name: filename, mimeType };
    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );

    const contentBlob =
      fileBody instanceof Blob
        ? fileBody
        : new Blob([fileBody], { type: mimeType });
    form.append('file', contentBlob);

    this.logger.debug(`[GoogleDrive] Uploading ${filename} (${mimeType})...`);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: form,
      }
    );

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`[GoogleDrive] Upload failed: ${err}`);
      throw new Error('Google Drive upload failed');
    }
  }
}
