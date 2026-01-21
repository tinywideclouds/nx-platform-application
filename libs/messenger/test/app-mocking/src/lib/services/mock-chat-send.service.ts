import { Injectable } from '@angular/core';
import { Observable, of, throwError, delay } from 'rxjs';
import { SecureEnvelope } from '@nx-platform-application/platform-types';
import { IChatSendService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { MockChatSendConfig } from '../scenarios.const';

@Injectable({ providedIn: 'root' })
export class MockChatSendService implements IChatSendService {
  // --- INTERNAL STATE ---
  private config: MockChatSendConfig = {
    shouldFail: false,
    latencyMs: 200,
  };

  // --- CONFIGURATION API (Scenario Driver) ---

  loadScenario(config: MockChatSendConfig) {
    console.log('[MockChatSendService] 🔄 Configuring Send Behavior:', config);
    // Merge with defaults to ensure safety
    this.config = {
      shouldFail: false,
      latencyMs: 200,
      ...config,
    };
  }

  // --- IChatSendService Implementation ---

  sendMessage(envelope: SecureEnvelope): Observable<void> {
    const { shouldFail, errorMsg, latencyMs } = this.config;

    console.log(
      `[MockChatSendService] 🚀 Sending (${shouldFail ? 'FAIL' : 'OK'})...`,
      {
        recipient: envelope.recipientId.toString(),
        payloadSize: envelope.encryptedData.length,
      },
    );

    // 1. Simulate Failure
    if (shouldFail) {
      // We still delay the error to simulate network round-trip failing
      return throwError(
        () => new Error(errorMsg || 'Simulated Network Error'),
      ).pipe(delay(latencyMs || 200));
    }

    // 2. Simulate Success
    return of(void 0).pipe(delay(latencyMs || 200));
  }
}
