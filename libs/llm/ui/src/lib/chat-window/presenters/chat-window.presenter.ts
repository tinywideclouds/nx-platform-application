import {
  Injectable,
  inject,
  signal,
  computed,
  untracked,
  effect,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { URN } from '@nx-platform-application/platform-types';
import { LlmMessage } from '@nx-platform-application/llm-types';

import { LlmScrollSource } from '@nx-platform-application/llm-features-chat';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { LlmChatActions } from '@nx-platform-application/llm-domain-conversation';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-session';
import {
  defaultMemoryProfiles,
  ContextAssembly,
} from '@nx-platform-application/llm-domain-context';

import { ChatDialogCoordinatorService } from './chat-dialog-coordinator.service';
import { ChatSelectionPresenter } from './chat-selection.presenter';

@Injectable()
export class ChatWorkspacePresenter {
  private source = inject(LlmScrollSource);
  private sessionSource = inject(LlmSessionSource);
  private actions = inject(LlmChatActions);
  private sessionActions = inject(LlmSessionActions);
  private snackBar = inject(MatSnackBar);
  private dialogs = inject(ChatDialogCoordinatorService);

  // Inject the new peer presenter to coordinate focus/selection states
  public selection = inject(ChatSelectionPresenter);

  // Core State
  focusedGroupUrn = signal<string | null>(null);

  // Tactical Override State
  temporaryModelOverride = signal<string | null>(null);
  overrideTurnCounter = signal(0);

  readonly session = computed(() => this.sessionSource.activeSession());

  readonly activeModelId = computed(() => {
    return this.temporaryModelOverride() || this.session()?.llmModel;
  });

  readonly activeContextGroups = computed(
    () => this.session()?.contextGroups || {},
  );

  readonly overrideRemaining = computed(() => {
    const override = this.temporaryModelOverride();
    if (!override) return null;
    const session = this.session();
    if (!session || !session.strategy) return null;

    const limit = session.strategy.secondaryModelLimit || 1;
    const used = this.overrideTurnCounter();
    return Math.max(0, limit - used);
  });

  readonly memoryProfiles = computed(() => {
    return this.session()?.strategy?.memoryProfiles || defaultMemoryProfiles;
  });

  readonly activeMemoryProfile = computed(() => {
    const profiles = this.memoryProfiles();
    const activeId = this.session()?.strategy?.activeMemoryProfileId;
    return profiles.find((p) => p.id === activeId) || profiles[0];
  });

  constructor() {
    effect(() => {
      const activeId = this.sessionSource.activeSessionId();
      if (activeId) {
        untracked(() => {
          this.source.setSession(activeId);
          this.temporaryModelOverride.set(null);
          this.overrideTurnCounter.set(0);
          this.focusedGroupUrn.set(null);
        });
      }
    });
  }

  async setActiveMemoryProfile(profileId: string) {
    const s = this.session();
    if (!s) return;

    const currentStrategy = s.strategy || {
      primaryModel: s.llmModel,
      fallbackStrategy: 'history_only',
      useCacheIfAvailable: true,
      memoryProfiles: defaultMemoryProfiles,
    };

    const updatedSession = {
      ...s,
      strategy: { ...currentStrategy, activeMemoryProfileId: profileId },
    };
    await this.sessionActions.updateSession(updatedSession);
  }

  setTacticalModel(modelId: string | null) {
    this.temporaryModelOverride.set(modelId);
    this.overrideTurnCounter.set(0);
  }

  handleSend(text: string) {
    if (!text) return;
    const currentId = this.source.activeSessionId();
    const session = this.session();

    if (currentId && session) {
      const modelToUse = this.activeModelId() || session.llmModel;

      this.actions.sendMessage(text, currentId, {
        modelToUse,
        onPreflight: (assembly: ContextAssembly) => {
          return this.dialogs.openPreflight(assembly, session);
        },
      });

      if (this.temporaryModelOverride()) {
        const nextCount = this.overrideTurnCounter() + 1;
        const limit = session.strategy?.secondaryModelLimit || 1;

        if (nextCount >= limit) {
          const prevModel = this.temporaryModelOverride();
          this.setTacticalModel(null);
          this.snackBar
            .open(`Override complete. Returning to default model.`, 'Extend', {
              duration: 5000,
            })
            .onAction()
            .subscribe(() => this.setTacticalModel(prevModel));
        } else {
          this.overrideTurnCounter.set(nextCount);
        }
      }
    }
  }

  private executeWithTransition(updateFn: () => void) {
    const doc = document as any;
    if (!doc.startViewTransition) {
      updateFn();
      return;
    }
    doc.startViewTransition(() => {
      updateFn();
    });
  }

  focusGroup(urnString: string) {
    this.executeWithTransition(() => {
      if (this.focusedGroupUrn() === urnString) {
        this.focusedGroupUrn.set(null);
      } else {
        this.focusedGroupUrn.set(urnString);
        this.selection.isSelectionMode.set(false); // Clean handoff!
      }
    });
  }

  clearFocus() {
    this.executeWithTransition(() => {
      this.focusedGroupUrn.set(null);
    });
  }

  isMessageInFocus(message: any): boolean {
    const focusUrn = this.focusedGroupUrn();
    if (!focusUrn || !message || typeof message === 'string' || !message.tags)
      return false;
    return message.tags.some((t: URN) => t.toString() === focusUrn);
  }

  async extractFocusedGroup() {
    const focusUrn = this.focusedGroupUrn();
    const currentId = this.source.activeSessionId();
    if (!focusUrn || !currentId) return;

    const ids = this.source
      .items()
      .map((item) => item.data)
      .filter(
        (msg): msg is LlmMessage =>
          !!msg && typeof msg !== 'string' && this.isMessageInFocus(msg),
      )
      .map((m) => m.id.toString());

    if (ids.length === 0) return;

    const result = await this.dialogs.openBranchContext();
    if (!result) return;

    try {
      const newSessionId = await this.actions.extractToNewSession(
        ids,
        result.mode,
      );
      this.clearFocus();
      this.sessionActions.openSession(newSessionId);
      const actionText = result.mode === 'copy' ? 'copied' : 'moved';
      this.snackBar.open(`Group ${actionText} to new session`, 'Close', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
      });
    } catch (e) {
      console.error('Extraction failed', e);
      this.snackBar.open('Failed to extract session', 'Close', {
        duration: 3000,
      });
    }
  }
}
