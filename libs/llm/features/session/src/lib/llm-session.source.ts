import { Injectable, inject, signal, computed } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { SessionStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmSession } from '@nx-platform-application/llm-types';

export type DisplaySession = LlmSession & { isOptimistic?: boolean };

@Injectable({ providedIn: 'root' })
export class LlmSessionSource {
  private sessionStorage = inject(SessionStorageService);

  readonly sessions = signal<LlmSession[]>([]);
  readonly activeSessionId = signal<URN | null>(null);

  readonly activeSession = computed(() => {
    const targetId = this.activeSessionId();
    if (!targetId) return null;
    return this.sessions().find((s) => s.id.equals(targetId)) || null;
  });

  constructor() {
    this.refresh();
  }

  setActiveSession(id: URN | null) {
    this.activeSessionId.set(id);
  }

  addOptimisticSession(id: URN): void {
    const now = Temporal.Now.instant();
    const fakeSession: DisplaySession = {
      id,
      title: 'New Session',
      llmModel: 'gemini-2.5-pro',
      lastModified: now.toString() as ISODateTimeString,
      isOptimistic: true,
      inlineContexts: [],
      systemContexts: [],
      quickContext: [],
    };

    this.sessions.update((list) => [fakeSession, ...list]);
  }

  async refresh(): Promise<void> {
    const sessionList = await this.sessionStorage.getSessions();
    this.sessions.set(sessionList);
  }
}
