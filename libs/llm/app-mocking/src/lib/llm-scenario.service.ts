import { Injectable, inject } from '@angular/core';
import {
  SessionStorageService,
  MessageStorageService,
} from '@nx-platform-application/llm-infrastructure-storage';
import { LLM_SCENARIOS } from './data/llm-scenarios.const';

@Injectable({ providedIn: 'root' })
export class LlmScenarioService {
  private sessionStorage = inject(SessionStorageService);
  private messageStorage = inject(MessageStorageService);

  /**
   * checks URL query params for ?scenario=key
   * Wipes DB -> Seeds Data
   */
  async initialize(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('scenario');

    if (!key) return; // Normal boot (preserve user data)

    const data = LLM_SCENARIOS[key];
    if (!data) {
      console.warn(`[LlmScenario] Unknown scenario: "${key}"`);
      return;
    }

    console.info(`[LlmScenario] Initializing: "${key}"`);

    // 1. Wipe (clearAllSessions clears both tables now)
    await this.sessionStorage.clearAllSessions();

    // 2. Seed Sessions
    for (const session of data.sessions) {
      await this.sessionStorage.saveSession(session);
    }

    // 3. Seed Messages
    if (data.messages.length > 0) {
      for (const msg of data.messages) {
        await this.messageStorage.saveMessage(msg);
      }
    }
  }
}
