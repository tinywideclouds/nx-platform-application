import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NOTIFICATION_SERVICE_URL } from './tokens';

@Injectable({ providedIn: 'root' })
export class DeviceRegistrationService {
  private http = inject(HttpClient);
  private baseUrl = inject(NOTIFICATION_SERVICE_URL);

  /**
   * Registers a Web Push Subscription (VAPID)
   * Payload matches WebPushSubscriptionPb (JSON)
   */
  async registerWeb(payload: any): Promise<void> {
    await firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/api/v1/register/web`, payload),
    );
  }

  /**
   * Unregisters a Web Push Subscription.
   * We only need the endpoint URL to identify the record.
   */
  async unregisterWeb(endpoint: string): Promise<void> {
    await firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/api/v1/unregister/web`, {
        endpoint,
      }),
    );
  }
}
