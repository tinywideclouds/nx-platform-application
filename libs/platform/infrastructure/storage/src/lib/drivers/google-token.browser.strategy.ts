import { inject, signal } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { PlatformStorageConfig } from '../vault.tokens';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IGoogleTokenStrategy } from './google-token.strategy';

// --- CONSTANTS ---
// --- STRATEGY A: LOCAL CLIENT (Client-Side Persistence) ---
export class LocalClientStrategy implements IGoogleTokenStrategy {
  private config = inject(PlatformStorageConfig);
  private logger = inject(Logger);

  private _isAuthenticated = signal(false);
  public isAuthenticated = this._isAuthenticated.asReadonly();

  private codeClient: any;
  private currentToken: string | null = null;
  private tokenExpiry = 0; // Epoch Milliseconds
  private readonly STORAGE_KEY = 'google_drive_session';

  constructor() {
    this.restoreSession();
  }

  public init() {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) return;

    // Singleton check
    if (!this.codeClient) {
      this.codeClient = google.accounts.oauth2.initCodeClient({
        client_id: this.config.googleClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        ux_mode: 'popup',
        callback: (resp: any) => this.handleCodeResponse(resp),
      });
    }
  }

  async getAccessToken(): Promise<string> {
    if (!this.currentToken || this.isExpired()) {
      throw new Error('TOKEN_EXPIRED');
    }
    return this.currentToken;
  }

  async connect(interactive: boolean): Promise<boolean> {
    if (!interactive) {
      return this._isAuthenticated();
    }

    return new Promise((resolve) => {
      // Lazy Init
      if (!this.codeClient) this.init();

      if (!this.codeClient) {
        this.logger.error('[LocalStrategy] Google SDK not initialized');
        resolve(false);
        return;
      }

      // Hook callback for this specific request
      const originalCallback = this.codeClient.callback;
      this.codeClient.callback = async (resp: any) => {
        const success = await this.handleCodeResponse(resp);
        resolve(success);
        if (originalCallback) this.codeClient.callback = originalCallback;
      };

      this.codeClient.requestCode();
    });
  }

  async disconnect(): Promise<void> {
    this.currentToken = null;
    this.tokenExpiry = 0;
    this._isAuthenticated.set(false);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private async handleCodeResponse(resp: any): Promise<boolean> {
    if (resp.code) {
      // Mocking token exchange for local strategy
      const mockToken =
        'mock_access_token_' + Temporal.Now.instant().epochMilliseconds;
      this.saveSession(mockToken, 3600);
      return true;
    }
    return false;
  }

  private isExpired(): boolean {
    return Temporal.Now.instant().epochMilliseconds > this.tokenExpiry;
  }

  private saveSession(token: string, expiresInSeconds: number) {
    this.currentToken = token;
    this.tokenExpiry = Temporal.Now.instant().add({
      seconds: expiresInSeconds,
    }).epochMilliseconds;

    this._isAuthenticated.set(true);
    localStorage.setItem(
      this.STORAGE_KEY,
      JSON.stringify({ token, expiry: this.tokenExpiry }),
    );
  }

  private restoreSession() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.expiry > Temporal.Now.instant().epochMilliseconds) {
          this.currentToken = data.token;
          this.tokenExpiry = data.expiry;
          this._isAuthenticated.set(true);
        }
      }
    } catch {
      /* ignore */
    }
  }
}
