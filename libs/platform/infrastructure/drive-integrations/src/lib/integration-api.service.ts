import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IntegrationStatus } from '@nx-platform-application/platform-types';

@Injectable({ providedIn: 'root' })
export class IntegrationApiService {
  private http = inject(HttpClient);
  private logger = inject(Logger);

  private readonly API_BASE = '/api/auth/integrations';

  /**
   * Checks the backend for active server-side links.
   * used by the State Layer to determine if a "Resume Session" is possible.
   */
  public async getStatus(): Promise<IntegrationStatus> {
    try {
      return await firstValueFrom(
        this.http.get<IntegrationStatus>(`${this.API_BASE}/status`),
      );
    } catch (e) {
      this.logger.warn('[IntegrationApi] Failed to check status', e);
      // Fail safe: assume nothing is connected so we don't block the UI
      return { google: false, dropbox: false };
    }
  }

  /**
   * Force disconnects a provider from the server side.
   * Note: This does not revoke the local token (State layer handles that).
   */
  public async disconnect(provider: 'google'): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`${this.API_BASE}/${provider}`));
    } catch (e) {
      this.logger.error(`[IntegrationApi] Failed to disconnect ${provider}`, e);
      throw e;
    }
  }
}
