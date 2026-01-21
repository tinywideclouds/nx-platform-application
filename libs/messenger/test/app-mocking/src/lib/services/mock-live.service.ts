import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { ConnectionStatus } from '@nx-platform-application/platform-types';
import { IChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { MockServerNetworkState } from '../scenarios.const';

@Injectable({ providedIn: 'root' })
export class MockLiveService implements IChatLiveDataService {
  // --- PUBLIC API ---
  public readonly status$ = new BehaviorSubject<ConnectionStatus>('connecting');
  public readonly incomingMessage$ = new Subject<void>();

  // --- CONFIGURATION API (Scenario Driver) ---

  /**
   * ✅ SCENARIO AWARE:
   * Determines connection behavior based on the network state.
   */
  loadScenario(config: MockServerNetworkState) {
    console.log('[MockLiveService] 🔄 Configuring Connection...');

    // Reset to connecting state first
    this.status$.next('connecting');

    // Logic: If we have pending messages, we delay the "Connected" event.
    // This ensures the App has time to fully boot and subscribe to the
    // stream before we trigger the "Fetch Messages" effect.
    if (config.queuedMessages.length > 0) {
      console.log(
        '[MockLiveService] ⏳ Delaying connection (waiting for app boot)...',
      );
      setTimeout(() => {
        console.log('[MockLiveService] 🟢 Connected.');
        this.status$.next('connected');
      }, 500);
    } else {
      // Happy Path: Instant connection
      console.log('[MockLiveService] 🟢 Connected immediately.');
      this.status$.next('connected');
    }
  }

  // --- IChatLiveDataService Implementation ---

  connect(tokenProvider: () => string): void {
    // In Mock Mode, connection is usually handled by the Scenario Loader.
    // However, if the app explicitly requests a reconnect, we can honor it.
    if (this.status$.value === 'disconnected') {
      this.status$.next('connecting');
      setTimeout(() => this.status$.next('connected'), 200);
    }
  }

  disconnect(): void {
    console.log('[MockLiveService] 🔴 Disconnected.');
    this.status$.next('disconnected');
  }
}
