import { Injectable, inject, signal, computed } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmSession } from '@nx-platform-application/llm-types';

export type DisplaySession = LlmSession & { isOptimistic?: boolean };

@Injectable({ providedIn: 'root' })
export class LlmSessionSource {
  private storage = inject(LlmStorageService);

  // The reactive state the sidebar will bind to
  readonly sessions = signal<LlmSession[]>([]);

  // NEW: Centralized active session tracking
  readonly activeSessionId = signal<URN | null>(null);

  // NEW: Provide the full resolved session to any consumer automatically
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
    const date = now.toZonedDateTimeISO('Europe/Paris');
    const fakeSession: DisplaySession = {
      id,
      title: date.year + ':' + date.month + ':' + date.day + ':' + id.entityId,
      lastModified: now.toString() as ISODateTimeString,
      isOptimistic: true,
      attachments: [],
    };

    this.sessions.update((list) => [fakeSession, ...list]);
  }

  async refresh(): Promise<void> {
    const sessionList = await this.storage.getSessions();
    this.sessions.set(sessionList);
  }
}
