import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Temporal } from '@js-temporal/polyfill';
import { URN } from '@nx-platform-application/platform-types';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmMessage } from '@nx-platform-application/llm-types';
import { TimeSeries } from '@nx-platform-application/scrollspace-core';

@Injectable({ providedIn: 'root' })
export class LlmScrollSource {
  private storage = inject(LlmStorageService);

  // 1. INPUTS
  readonly activeSessionId = signal<URN | null>(null);

  // 2. STATE (Raw Domain Data)
  private _messages = signal<LlmMessage[]>([]);
  readonly isGenerating = signal(false);

  constructor() {
    // Reactively load history when Session ID changes
    effect(async () => {
      const sessionId = this.activeSessionId();
      if (!sessionId) {
        this._messages.set([]);
        return;
      }
      const history = await this.storage.getSessionMessages(sessionId);
      this._messages.set(history);
    });
  }

  // 3. OUTPUT (Visual Transformation)
  // ✅ This is the missing link that wraps LlmMessage -> ScrollItem<LlmMessage>
  readonly items = computed(() => {
    return TimeSeries.transform(this._messages(), {
      getTimestamp: (m) => Temporal.Instant.from(m.timestamp),
      getActorId: (m) => m.role,
      getAlignment: (m) => (m.role === 'user' ? 'end' : 'start'),
      timeZone: 'UTC',
    });
  });

  readonly items$ = toObservable(this.items);

  removeMessage(id: URN) {
    this._messages.update((msgs) =>
      msgs.filter((m) => m.id.toString() !== id.toString()),
    );
  }

  // --- Actions ---
  setSession(id: URN) {
    this.activeSessionId.set(id);
  }
  setLoading(v: boolean) {
    this.isGenerating.set(v);
  }
  addMessage(msg: LlmMessage) {
    this._messages.update((p) => [...p, msg]);
  }

  updateMessagePayload(id: URN, bytes: Uint8Array) {
    this._messages.update((prev) =>
      prev.map((m) => (m.id.equals(id) ? { ...m, payloadBytes: bytes } : m)),
    );
  }

  // NEW: Syncs tags into the active UI state
  updateMessageTags(id: URN, tags: URN[]) {
    this._messages.update((prev) =>
      prev.map((m) => (m.id.equals(id) ? { ...m, tags } : m)),
    );
  }

  removeMessages(ids: URN[]) {
    const idStrings = new Set(ids.map((id) => id.toString()));
    this._messages.update((prev) =>
      prev.filter((m) => !idStrings.has(m.id.toString())),
    );
  }

  updateMessageExclusions(ids: URN[], isExcluded: boolean) {
    const idStrings = new Set(ids.map((id) => id.toString()));
    this._messages.update((prev) =>
      prev.map((m) =>
        idStrings.has(m.id.toString()) ? { ...m, isExcluded } : m,
      ),
    );
  }
}
