import {
  Injectable,
  signal,
  computed,
  inject,
  effect,
  untracked,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Temporal } from '@js-temporal/polyfill';
import { URN } from '@nx-platform-application/platform-types';
import { MessageStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import {
  FileLinkType,
  FileProposalType,
  LlmMessage,
} from '@nx-platform-application/llm-types';
import { TimeSeries } from '@nx-platform-application/scrollspace-core';
import { LlmMemoryManagerService } from '@nx-platform-application/llm-domain-memory-manager';

@Injectable({ providedIn: 'root' })
export class LlmScrollSource {
  private messageStorage = inject(MessageStorageService);
  private memoryManager = inject(LlmMemoryManagerService); // NEW

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
      const history = await this.messageStorage.getSessionMessages(sessionId);
      this._messages.set(history);
    });

    // NEW: Reactive Memory Analysis
    effect(() => {
      const messages = this._messages();
      const isGenerating = this.isGenerating();

      // Only run the heavy analysis when the bot is idle and we have data
      if (!isGenerating && messages.length > 0) {
        untracked(() => {
          // this.memoryManager.analyzeAndCompressDryRun(messages);
        });
      }
    });
  }

  // 3. OUTPUT (Visual Transformation)
  readonly items = computed(() => {
    const rawItems = TimeSeries.transform(this._messages(), {
      getTimestamp: (m) => Temporal.Instant.from(m.timestamp),
      getActorId: (m) => m.role,
      getAlignment: (m) => (m.role === 'user' ? 'end' : 'start'),
      timeZone: 'UTC',
    });

    return rawItems.map((item, index, array) => {
      if (item.type !== 'content') return item;

      const data = item.data as LlmMessage;
      const isProposal =
        data.typeId.equals(FileProposalType) ||
        data.typeId.equals(FileLinkType);

      let prevRole: string | null = null;
      let nextRole: string | null = null;

      for (let i = index - 1; i >= 0; i--) {
        if (array[i].type === 'content') {
          prevRole = (array[i].data as LlmMessage).role;
          break;
        }
      }

      for (let i = index + 1; i < array.length; i++) {
        if (array[i].type === 'content') {
          nextRole = (array[i].data as LlmMessage).role;
          break;
        }
      }

      const currentRole = data.role;
      const matchesPrev = prevRole === currentRole;
      const matchesNext = nextRole === currentRole;

      let isContinuous = true;
      let positionInGroup: 'first' | 'middle' | 'last' | undefined;
      if (matchesPrev && matchesNext) {
        positionInGroup = 'middle';
      } else if (!matchesPrev && matchesNext) {
        positionInGroup = 'first';
      } else if (matchesPrev && !matchesNext) {
        positionInGroup = 'last';
      } else {
        isContinuous = false;
      }

      return {
        ...item,
        layout: {
          ...item.layout,
          fullWidth: isProposal,
          isContinuous,
          positionInGroup,
        },
      };
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
