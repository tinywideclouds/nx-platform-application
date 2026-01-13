import { InjectionToken, inject, signal, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, tap, catchError, of } from 'rxjs';
import { PlatformStorageConfig } from '../vault.tokens';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

// --- SHARED TYPES ---
export interface IGoogleTokenStrategy {
  /** Signal indicating if we have a valid session/link */
  isAuthenticated: Signal<boolean>;

  /**
   * Returns a valid access token.
   * Throws if interaction is required.
   */
  getAccessToken(): Promise<string>;

  /**
   * Triggers the user-facing "Connect" flow.
   * @param persist - Whether to remember this session (e.g. localStorage)
   */
  connect(persist: boolean): Promise<boolean>;

  /**
   * Disconnects the session.
   */
  disconnect(): Promise<void>;
}

export const GOOGLE_TOKEN_STRATEGY = new InjectionToken<IGoogleTokenStrategy>(
  'GOOGLE_TOKEN_STRATEGY',
);

// --- STRATEGY A: LOCAL CLIENT (Pure Client-Side) ---
export class LocalClientStrategy implements IGoogleTokenStrategy {
  private config = inject(PlatformStorageConfig);
  private logger = inject(Logger);

  private _isAuthenticated = signal(false);
  public isAuthenticated = this._isAuthenticated.asReadonly();

  private tokenClient: any;
  private tokenExpiry = 0;
  private accessToken = '';
  private shouldPersist = false;

  constructor() {
    this.restoreSession();
  }

  public init(gapiClient: any) {
    this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: this.config.googleClientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp: any) => this.handleTokenResponse(resp),
    });
  }

  async getAccessToken(): Promise<string> {
    if (Date.now() < this.tokenExpiry && this.accessToken) {
      return this.accessToken;
    }
    this._isAuthenticated.set(false);
    throw new Error('TOKEN_EXPIRED');
  }

  async connect(persist: boolean): Promise<boolean> {
    this.shouldPersist = persist;
    return new Promise((resolve) => {
      try {
        // We wrap the callback resolution in a promise for the 'link' method
        const originalCallback = this.tokenClient.callback;

        this.tokenClient.callback = (resp: any) => {
          this.handleTokenResponse(resp);
          resolve(!!resp.access_token);
          // Restore original just in case
          if (originalCallback) this.tokenClient.callback = originalCallback;
        };

        this.tokenClient.requestAccessToken({ prompt: '' });
      } catch (e) {
        this.logger.error('[Drive] Connect failed', e);
        resolve(false);
      }
    });
  }

  async disconnect(): Promise<void> {
    const token = this.accessToken;
    if (token && (window as any).google) {
      (window as any).google.accounts.oauth2.revoke(token, () => {});
    }
    this.accessToken = '';
    this.tokenExpiry = 0;
    this._isAuthenticated.set(false);
    localStorage.removeItem('google_drive_token');
  }

  private handleTokenResponse(resp: any) {
    if (resp.error) {
      this.logger.error('[Drive] Token error', resp);
      return;
    }
    this.accessToken = resp.access_token;
    this.tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000 - 60000;
    this._isAuthenticated.set(true);

    if (this.shouldPersist) {
      localStorage.setItem(
        'google_drive_token',
        JSON.stringify({
          token: this.accessToken,
          expiry: this.tokenExpiry,
        }),
      );
    }
  }

  private restoreSession() {
    try {
      const stored = localStorage.getItem('google_drive_token');
      if (stored) {
        const data = JSON.parse(stored);
        if (Date.now() < data.expiry) {
          this.accessToken = data.token;
          this.tokenExpiry = data.expiry;
          this._isAuthenticated.set(true);
          this.shouldPersist = true;
        }
      }
    } catch (e) {
      /* ignore */
    }
  }
}

// --- STRATEGY B: SERVER IDENTITY (Managed) ---
export class IdentityServerStrategy implements IGoogleTokenStrategy {
  private http = inject(HttpClient);
  private config = inject(PlatformStorageConfig);
  private logger = inject(Logger);

  private _isAuthenticated = signal(false);
  public isAuthenticated = this._isAuthenticated.asReadonly();

  private codeClient: any;
  private currentToken = '';
  private tokenExpiry = 0;
  private readonly API_BASE = '/api/auth/integrations/google';

  constructor() {
    this.checkServerStatus();
  }

  public init(gapiClient: any) {
    this.codeClient = (window as any).google.accounts.oauth2.initCodeClient({
      client_id: this.config.googleClientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      ux_mode: 'popup',
      callback: (resp: any) => this.handleCodeResponse(resp),
    });
  }

  async getAccessToken(): Promise<string> {
    if (Date.now() < this.tokenExpiry && this.currentToken) {
      return this.currentToken;
    }
    try {
      const resp = await firstValueFrom(
        this.http.get<{ accessToken: string; expiresIn: number }>(
          `${this.API_BASE}/token`,
        ),
      );
      this.currentToken = resp.accessToken;
      this.tokenExpiry = Date.now() + resp.expiresIn * 1000 - 60000;
      this._isAuthenticated.set(true);
      return this.currentToken;
    } catch (error) {
      this._isAuthenticated.set(false);
      throw error;
    }
  }

  async connect(persist: boolean): Promise<boolean> {
    // Note: 'persist' argument is ignored because Server persistence
    // is managed by the Identity Service policy, not the client.
    return new Promise((resolve) => {
      // We hook the code client response
      const originalCallback = this.codeClient.callback;
      this.codeClient.callback = async (resp: any) => {
        await this.handleCodeResponse(resp);
        resolve(this.isAuthenticated()); // Resolve based on result
        if (originalCallback) this.codeClient.callback = originalCallback;
      };
      this.codeClient.requestCode();
    });
  }

  async disconnect(): Promise<void> {
    await firstValueFrom(this.http.delete('/api/integrations/google'));
    this.currentToken = '';
    this.tokenExpiry = 0;
    this._isAuthenticated.set(false);
  }

  private async handleCodeResponse(resp: any) {
    if (resp.code) {
      try {
        const result = await firstValueFrom(
          this.http.post<{
            status: string;
            accessToken: string;
            expiresIn: number;
          }>(`${this.API_BASE}/link`, { code: resp.code }),
        );
        if (result.status === 'linked') {
          this.currentToken = result.accessToken;
          this.tokenExpiry = Date.now() + result.expiresIn * 1000 - 60000;
          this._isAuthenticated.set(true);
        }
      } catch (e) {
        this.logger.error('[Drive] Link failed', e);
      }
    }
  }

  private checkServerStatus() {
    this.http
      .get<{ google: boolean }>('/api/integrations/status')
      .pipe(
        tap((status) => {
          if (status.google) {
            this.getAccessToken().catch(() => {});
          }
        }),
        catchError(() => of(null)),
      )
      .subscribe();
  }
}
