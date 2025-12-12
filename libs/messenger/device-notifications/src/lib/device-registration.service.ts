import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NOTIFICATION_SERVICE_URL } from './tokens';

export interface DeviceToken {
  token: string;
  platform: 'web' | 'android' | 'ios';
}

@Injectable({ providedIn: 'root' })
export class DeviceRegistrationService {
  private http = inject(HttpClient);
  private baseUrl = inject(NOTIFICATION_SERVICE_URL);

  /**
   * Registers the device token with the backend.
   * Uses firstValueFrom to convert the Observable to a Promise,
   * aligning with the "Stability First" preference for clean async/await flows.
   */
  async register(token: string): Promise<void> {
    const payload: DeviceToken = {
      token,
      platform: 'web',
    };

    // Calls PUT /tokens on the go-notification-service
    await firstValueFrom(
      this.http.put<void>(`${this.baseUrl}/tokens`, payload),
    );
  }
}
