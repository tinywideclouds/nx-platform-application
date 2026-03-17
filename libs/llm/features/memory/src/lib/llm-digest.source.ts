import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { LlmMemoryDigest } from '@nx-platform-application/llm-types';

// INJECT THE NEW DOMAIN SERVICE INSTEAD OF STORAGE
import { LlmDigestService } from '@nx-platform-application/llm-domain-digest';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';

@Injectable({ providedIn: 'root' })
export class LlmDigestSource {
  private digestService = inject(LlmDigestService); // <-- Updated
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

  private async loadDigests(sessionId: URN) {
    // Call the Domain Service
    const history = await this.digestService.getDigestsForSession(sessionId);

    // Sort chronologically (oldest digest first)
    const sorted = history.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    this._digests.set(sorted);
  }

  refresh() {
    const session = this.sessionSource.activeSession();
    if (session) {
      this.loadDigests(session.id);
    }
  }
}
