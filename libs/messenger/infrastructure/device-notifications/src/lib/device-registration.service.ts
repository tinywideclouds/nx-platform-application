import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { NOTIFICATION_SERVICE_URL } from './tokens';

@Injectable({ providedIn: 'root' })
export class DeviceRegistrationService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(Logger);

  private readonly baseApiUrl =
    inject(NOTIFICATION_SERVICE_URL, { optional: true }) ?? '/api';

  /**
   * Registers a Web Push Subscription (VAPID).
   */
  async registerWeb(payload: unknown): Promise<void> {
    this.logger.debug(
      `Registering web push subscription ${this.baseApiUrl}/v1/register/web`,
    );
    await firstValueFrom(
      this.http.post<void>(`${this.baseApiUrl}/v1/register/web`, payload),
    );
  }

  async unregisterWeb(endpoint: string): Promise<void> {
    await firstValueFrom(
      this.http.post<void>(`${this.baseApiUrl}/v1/unregister/web`, {
        endpoint,
      }),
    );
  }
}
