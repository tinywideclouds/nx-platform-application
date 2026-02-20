import { Injectable, inject, signal } from '@angular/core';
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

  constructor() {
    // Hydrate immediately on instantiation
    this.refresh();
  }

  /**
   * Pushes a temporary session into the UI state so it feels instantly responsive.
   */
  addOptimisticSession(id: URN): void {
    const now = Temporal.Now.instant();
    const date = now.toZonedDateTimeISO('Europe/Paris');
    const fakeSession: DisplaySession = {
      id,
      title: date.year + ':' + date.month + ':' + date.day + ':' + id.entityId,
      lastModified: now.toString() as ISODateTimeString,
      isOptimistic: true,
    };

    this.sessions.update((list) => [fakeSession, ...list]);
  }
  /**
   * Fetches the latest sessions from the database (Ordered by LastModified DESC)
   * and updates the reactive signal.
   */
  async refresh(): Promise<void> {
    const sessionList = await this.storage.getSessions();
    this.sessions.set(sessionList);
  }
}
