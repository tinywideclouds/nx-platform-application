import { Injectable, inject } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { ConnectionStatus } from '@nx-platform-application/platform-types';
import { IChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MockServerNetworkState } from '../types';

@Injectable({ providedIn: 'root' })
export class MockLiveService implements IChatLiveDataService {
  private logger = inject(Logger).withPrefix('[Mock:Live]');

  // --- PUBLIC API ---
  public readonly status$ = new BehaviorSubject<ConnectionStatus>('connecting');
  public readonly incomingMessage$ = new Subject<void>();

  // --- CONFIGURATION API (Scenario Driver) ---

  loadScenario(config: MockServerNetworkState) {
    this.logger.info('🔄 Configuring Connection...');
    this.status$.next('connecting');

    // ✅ TYPE SAFE: config.queuedMessages is now ScenarioItem[], but length check works identically.
    if (config.queuedMessages.length > 0) {
      this.logger.info('⏳ Delaying connection (waiting for app boot)...');
      setTimeout(() => {
        this.logger.info('🟢 Connected.');
        this.status$.next('connected');
      }, 500);
    } else {
      this.logger.info('🟢 Connected immediately.');
      this.status$.next('connected');
    }
  }

  // --- DIRECTOR API ---
  trigger() {
    this.logger.info('🔔 Triggering Inbound Signal...');
    this.incomingMessage$.next();
  }

  // --- IChatLiveDataService Implementation ---
  connect(tokenProvider: () => string): void {
    if (this.status$.value === 'disconnected') {
      this.status$.next('connecting');
      setTimeout(() => this.status$.next('connected'), 200);
    }
  }

  disconnect(): void {
    this.logger.info('🔴 Disconnected.');
    this.status$.next('disconnected');
  }
}
