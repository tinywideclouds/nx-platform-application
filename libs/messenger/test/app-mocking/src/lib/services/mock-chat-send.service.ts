import { Injectable } from '@angular/core';
import { Observable, timer, map } from 'rxjs';
import { Subject } from 'rxjs';
import { SecureEnvelope } from '@nx-platform-application/platform-types';

import { MockChatSendConfig } from '../types';

export interface OutboundEvent {
  envelope: SecureEnvelope;
}

@Injectable({ providedIn: 'root' })
export class MockChatSendService {
  // ✅ NEW: Event Stream for the Director
  public readonly outboundMessage$ = new Subject<OutboundEvent>();

  private config: MockChatSendConfig = {
    shouldFail: false,
    latencyMs: 500,
  };

  loadScenario(config: MockChatSendConfig) {
    this.config = config;
  }

  /**
   * MOCK IMPLEMENTATION: IChatSendService
   * Signature: abstract sendMessage(envelope: SecureEnvelope): Observable<void>;
   */
  sendMessage(envelope: SecureEnvelope): Observable<void> {
    // 1. Fire Event immediately so Director knows intent
    this.outboundMessage$.next({ envelope });

    // 2. Simulate Network Latency
    const delay = this.config.latencyMs ?? 500;

    return timer(delay).pipe(
      map(() => {
        // 3. Simulate Failure if Configured
        if (this.config.shouldFail) {
          throw new Error(this.config.errorMsg || 'Mock Network Error');
        }
        console.log(`[MockSend] 🚀 Sent envelope to ${envelope.recipientId}`);
      }),
    );
  }
}
