import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import {
  CloudStorageProvider,
  CloudBackupMetadata,
} from '../cloud-provider.interface';
import { PLATFORM_CLOUD_CONFIG } from '../tokens/cloud-config.token';

// Declare Google Identity Services global types to avoid TS errors
declare const google: any;

@Injectable()
export class GoogleDriveService implements CloudStorageProvider {
  readonly providerId = 'google';
  private logger = inject(Logger);
  private config = inject(PLATFORM_CLOUD_CONFIG, { optional: true });

  // Scope: 'drive.file' grants access ONLY to files created by this app.
  private readonly SCOPE = 'https://www.googleapis.com/auth/drive.file';

  // The GIS Token Client instance
  private tokenClient: any;
  // The active OAuth2 access token
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

  /**
   * Initializes the Google Identity Services (GIS) Token Client.
   * This client is responsible for popping up the consent dialog.
   */
  private initializeGoogleIdentityClient(): void {
    if (typeof google === 'undefined') {
      this.logger.warn(
        '[GoogleDrive] Google Identity Services script not loaded.'
      );
      return;
    }

    if (!this.config?.googleClientId) {
      return;
    }

    try {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.config.googleClientId,
        scope: this.SCOPE,
        // Default callback (can be overridden per request)
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
    // Check if we have a token AND if that token covers the required scope
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
      // Override the callback specifically for this request to capture the result
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

      // Trigger the popup
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  /**
   * Uploads content to Google Drive.
   * Handles String (JSON), Blob (Binary), or Objects (auto-stringified).
   */
  async uploadBackup(
    content: unknown,
    filename: string
  ): Promise<CloudBackupMetadata> {
    if (!this.accessToken) {
      throw new Error('No access token available. Request access first.');
    }

    // 1. Determine Content Type & Body
    let fileBody: Blob | string;
    let mimeType = 'application/json';

    if (content instanceof Blob) {
      fileBody = content;
      mimeType = content.type || 'application/octet-stream';
    } else if (typeof content === 'string') {
      fileBody = content;
      // Heuristic: If it looks like JSON, treat as JSON, else text
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        mimeType = 'application/json';
      } else {
        mimeType = 'text/plain';
      }
    } else {
      // Default: Assume generic object -> JSON
      fileBody = JSON.stringify(content);
      mimeType = 'application/json';
    }

    // 2. Prepare Metadata
    const metadata = {
      name: filename,
      mimeType,
    };

    // 3. Prepare Multipart Request Body
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

    // 4. Upload via REST API
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime',
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

    const data = await response.json();
    return {
      fileId: data.id,
      name: data.name,
      createdAt: data.createdTime,
      sizeBytes: parseInt(data.size, 10),
    };
  }

  /**
   * Lists files created by this app.
   * Supports optional substring filtering.
   */
  async listBackups(querySubstring?: string): Promise<CloudBackupMetadata[]> {
    if (!this.accessToken) {
      throw new Error('No access token available. Request access first.');
    }

    // Filter by name prefix and ensure not trashed
    let query = 'trashed = false';
    if (querySubstring) {
      // Escape single quotes to prevent injection-like issues
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
}
