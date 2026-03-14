import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { DigestStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmMemoryDigest } from '@nx-platform-application/llm-types';

// INJECT THE GLOBAL SESSION STATE
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';

@Injectable({ providedIn: 'root' })
export class LlmDigestSource {
  private digestStorage = inject(DigestStorageService);
  private sessionSource = inject(LlmSessionSource);

  // 1. STATE
  private _digests = signal<LlmMemoryDigest[]>([]);

  // 2. COMPUTED OUTPUTS
  readonly digests = computed(() => this._digests());

  readonly coveredMessageIds = computed(() => {
    const ids = new Set<string>();
    for (const d of this._digests()) {
      d.coveredMessageIds.forEach((id) => ids.add(id.toString()));
    }
    return ids;
  });

  constructor() {
    // Reactively load history whenever the global Session changes
    effect(() => {
      const session = this.sessionSource.activeSession();
      if (session) {
        this.loadDigests(session.id);
      } else {
        this._digests.set([]);
      }
    });
  }

  // --- Actions ---

  // A clean, dedicated method to fetch and sort the data
  private async loadDigests(sessionId: URN) {
    const history = await this.digestStorage.getSessionDigests(sessionId);
    // Sort chronologically (oldest digest first)
    const sorted = history.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    this._digests.set(sorted);
  }

  // Safely triggers a re-fetch for the currently active session
  refresh() {
    const session = this.sessionSource.activeSession();
    if (session) {
      this.loadDigests(session.id);
    }
  }
}
