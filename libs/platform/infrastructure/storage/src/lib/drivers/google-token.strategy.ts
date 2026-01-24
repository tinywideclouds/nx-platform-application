import { InjectionToken, inject, signal, Signal } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Temporal } from '@js-temporal/polyfill';
import { firstValueFrom } from 'rxjs';
import { PlatformStorageConfig } from '../vault.tokens';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

// --- CONSTANTS ---
const REFRESH_BUFFER = { minutes: 1 }; // Refresh 1 minute before actual expiry

// --- SHARED CONTRACT ---
export interface IGoogleTokenStrategy {
  isAuthenticated: Signal<boolean>;

  /**
   * Initializes the Google OAuth2 Code Client.
   * Safe to call multiple times.
   */
  init(): void;

  /**
   * Returns a valid access token.
   * Throws if interaction is needed (does NOT auto-popup).
   */
  getAccessToken(): Promise<string>;

  /**
   * Handshake Flow:
   * - persist=false: Check Storage/Server for existing session (Silent)
   * - persist=true:  Open Popup (Interactive)
   */
  connect(persist: boolean): Promise<boolean>;

  disconnect(): Promise<void>;
}

export const GOOGLE_TOKEN_STRATEGY = new InjectionToken<IGoogleTokenStrategy>(
  'GOOGLE_TOKEN_STRATEGY',
);

// --- STRATEGY B: SERVER IDENTITY (Managed) ---
export class IdentityServerStrategy implements IGoogleTokenStrategy {
  // ✅ FIX 1: Use HttpBackend to bypass global interceptors (Popup Blocker Fix)
  private handler = inject(HttpBackend);
  private http: HttpClient;

  private config = inject(PlatformStorageConfig);
  private logger = inject(Logger);

  private _isAuthenticated = signal(false);
  public isAuthenticated = this._isAuthenticated.asReadonly();

  private codeClient: any;
  private currentToken = '';
  private tokenExpiry = 0;

  // ✅ FIX 2: Correct Path matches Proxy + Backend
  private readonly API_BASE = '/api/auth/integrations/drive/google';

  // Barrier to prevent race conditions during boot
  private _initRequest: Promise<void> | null = null;

  constructor() {
    // Create a pristine HttpClient (No interceptors = No auto-redirects/popups)
    this.http = new HttpClient(this.handler);
  }

  public init() {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) return;

    if (!this.codeClient) {
      this.codeClient = google.accounts.oauth2.initCodeClient({
        client_id: this.config.googleClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        ux_mode: 'popup',
        callback: (resp: any) => this.handleCodeResponse(resp),
      });
    }
  }

  private get initPromise(): Promise<void> {
    if (!this._initRequest) {
      this._initRequest = this.resumeSession();
    }
    return this._initRequest;
  }

  async getAccessToken(): Promise<string> {
    // Wait for initial check to finish
    await this.initPromise;

    if (this.isValid()) {
      return this.currentToken;
    }

    // Try one silent fetch. If it fails, THROW. Do NOT popup.
    // This allows the Driver to catch it and say "Not Ready".
    return this.fetchServerToken();
  }

  async connect(interactive: boolean): Promise<boolean> {
    // 1. Silent Mode (Boot)
    if (!interactive) {
      try {
        await this.initPromise;
        if (this.isValid()) return true;
        // Last ditch silent effort
        await this.fetchServerToken();
        return true;
      } catch {
        return false; // Just return false, don't blow up
      }
    }

    // 2. Interactive Mode (User Clicked Button)
    return new Promise((resolve) => {
      // Lazy Init
      if (!this.codeClient) this.init();

      if (!this.codeClient) {
        this.logger.error('[IdentityStrategy] Google SDK not loaded');
        resolve(false);
        return;
      }

      const originalCallback = this.codeClient.callback;
      this.codeClient.callback = async (resp: any) => {
        await this.handleCodeResponse(resp);
        resolve(this._isAuthenticated());
        if (originalCallback) this.codeClient.callback = originalCallback;
      };

      this.codeClient.requestCode();
    });
  }

  async disconnect(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(
          `${this.API_BASE.replace('/drive/google', '')}/drive/google`,
        ),
      );
    } catch {}

    this.currentToken = '';
    this.tokenExpiry = 0;
    this._isAuthenticated.set(false);
  }

  // --- HELPERS ---

  private isValid(): boolean {
    return (
      !!this.currentToken &&
      Temporal.Now.instant().epochMilliseconds < this.tokenExpiry
    );
  }

  private async fetchServerToken(): Promise<string> {
    // ✅ Uses bypassed HTTP client, so 401s won't trigger global interceptors
    const resp = await firstValueFrom(
      this.http.get<{ accessToken: string; expiresIn: number }>(
        `${this.API_BASE}/token`,
      ),
    );
    this.updateState(resp.accessToken, resp.expiresIn);
    return this.currentToken;
  }

  private async resumeSession() {
    try {
      await this.fetchServerToken();
    } catch {
      // Silent failure is expected here on fresh boot.
      // We do NOTHING. isAuthenticated remains false.
    }
  }

  private async handleCodeResponse(resp: any) {
    if (resp.code) {
      try {
        const result = await firstValueFrom(
          this.http.post<any>(`${this.API_BASE}/link`, { code: resp.code }),
        );
        if (result.status === 'linked') {
          this.updateState(result.accessToken, result.expiresIn);
        }
      } catch (e) {
        this.logger.error('[IdentityStrategy] Link failed', e);
      }
    }
  }

  private updateState(token: string, expiresInSeconds: number) {
    this.currentToken = token;
    this.tokenExpiry = Temporal.Now.instant()
      .add({ seconds: expiresInSeconds })
      .subtract(REFRESH_BUFFER).epochMilliseconds;

    this._isAuthenticated.set(true);
  }
}
