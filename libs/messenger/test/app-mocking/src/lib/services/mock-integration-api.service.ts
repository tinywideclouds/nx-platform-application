import { Injectable } from '@angular/core';
import { IntegrationStatus } from '@nx-platform-application/platform-types';

@Injectable({ providedIn: 'root' })
export class MockIntegrationApiService {
  async getStatus(): Promise<IntegrationStatus> {
    console.log('[MockIntegrationApi] getStatus: Returning disconnected state');
    // Default to "No Integrations" to prevent the UI from trying to resume cloud sessions
    return { google: false, dropbox: false };
  }

  async disconnect(provider: string): Promise<void> {
    console.log(`[MockIntegrationApi] Disconnecting ${provider}...`);
    // No-op success
  }
}
