import { Injectable, inject, signal, computed } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  SessionStorageService,
  CompiledCacheStorageService,
} from '@nx-platform-application/llm-infrastructure-storage';
import { LlmSession } from '@nx-platform-application/llm-types';

export type DisplaySession = LlmSession & { isOptimistic?: boolean };

@Injectable({ providedIn: 'root' })
export class LlmSessionSource {
  private sessionStorage = inject(SessionStorageService);
  private cacheStorage = inject(CompiledCacheStorageService);

  // The reactive state the sidebar will bind to
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
    const sessionList = await this.sessionStorage.getSessions();

    // HYDRATION: The domain coordinator joins the cached data into the session objects
    const hydratedSessions = await Promise.all(
      sessionList.map(async (session) => {
        if (session.compiledCache?.id) {
          const fullCache = await this.cacheStorage.getCache(
            session.compiledCache.id,
          );

          if (fullCache) {
            return { ...session, compiledCache: fullCache };
          } else {
            // If it points to a dead cache in the DB, we strip the stub to prevent frontend errors
            return { ...session, compiledCache: undefined };
          }
        }
        return session;
      }),
    );

    this.sessions.set(hydratedSessions);
  }
}
