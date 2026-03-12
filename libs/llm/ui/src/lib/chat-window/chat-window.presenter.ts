import {
  Injectable,
  inject,
  signal,
  computed,
  untracked,
  effect,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { URN } from '@nx-platform-application/platform-types';
import { LlmMessage } from '@nx-platform-application/llm-types';

import { LlmScrollSource } from '@nx-platform-application/llm-features-chat';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { LlmChatActions } from '@nx-platform-application/llm-domain-conversation';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-session';

import {
  GroupContextDialogComponent,
  GroupContextDialogResult,
} from '../group-context-dialog/group-context-dialog.component';
import {
  BranchContextDialogComponent,
  BranchContextDialogResult,
} from '../branch-context-dialog/branch-context-dialog.component';
import { LlmEditMessageDialogComponent } from '../edit-message-dialog/edit-message-dialog.component';

@Injectable()
export class ChatWorkspacePresenter {
  private source = inject(LlmScrollSource);
  private sessionSource = inject(LlmSessionSource);
  private actions = inject(LlmChatActions);
  private sessionActions = inject(LlmSessionActions);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  // Core State
  isSelectionMode = signal(false);
  selectedIds = signal<Set<string>>(new Set());
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

  // NEW: Calculate remaining turns for the UI badge
  readonly overrideRemaining = computed(() => {
    const override = this.temporaryModelOverride();
    if (!override) return null;
    const session = this.session();
    if (!session || !session.strategy) return null;

    const limit = session.strategy.secondaryModelLimit || 1;
    const used = this.overrideTurnCounter();
    return Math.max(0, limit - used);
  });

  constructor() {
    effect(() => {
      // Reset overrides when switching sessions
      const activeId = this.sessionSource.activeSessionId();
      if (activeId) {
        untracked(() => {
          this.source.setSession(activeId);

          this.temporaryModelOverride.set(null);
          this.overrideTurnCounter.set(0);
          this.focusedGroupUrn.set(null);
          this.isSelectionMode.set(false);
          this.selectedIds.set(new Set());
        });
      }
    });
  }

  // --- Tactical Overrides ---
  setTacticalModel(modelId: string | null) {
    this.temporaryModelOverride.set(modelId);
    this.overrideTurnCounter.set(0);
  }

  // --- Send Logic ---
  handleSend(text: string) {
    if (!text) return;
    const currentId = this.source.activeSessionId();
    const session = this.session();

    if (currentId && session) {
      const modelToUse = this.activeModelId() || session.llmModel;
      this.actions.sendMessage(text, currentId, modelToUse);

      // Handle Override Life-cycle
      if (this.temporaryModelOverride()) {
        const nextCount = this.overrideTurnCounter() + 1;
        const limit = session.strategy?.secondaryModelLimit || 1;

        if (nextCount >= limit) {
          const prevModel = this.temporaryModelOverride();

          // FIX: Automatically revert to default model
          this.setTacticalModel(null);

          // FIX: Updated message and "Extend" action
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

  // --- Selection Mode ---
  toggleSelectionMode() {
    this.isSelectionMode.set(!this.isSelectionMode());
    this.selectedIds.set(new Set());
  }

  // --- Focus Management ---
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
        this.isSelectionMode.set(false);
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

  // --- Branching / Extracting ---
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

    const dialogRef = this.dialog.open<
      BranchContextDialogComponent,
      any,
      BranchContextDialogResult
    >(BranchContextDialogComponent, { width: '450px' });

    const result = await dialogRef.afterClosed().toPromise();
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

  // --- Context Selection Actions ---
  async groupSelected() {
    const ids = Array.from(this.selectedIds());
    const session = this.session();
    if (!session) return;

    const existingGroups = Object.entries(this.activeContextGroups()).map(
      ([urn, name]) => ({
        urn,
        name: String(name),
      }),
    );

    const dialogRef = this.dialog.open<
      GroupContextDialogComponent,
      { existingGroups: { urn: string; name: string }[] },
      GroupContextDialogResult
    >(GroupContextDialogComponent, {
      width: '400px',
      data: { existingGroups },
    });

    const result = await dialogRef.afterClosed().toPromise();

    if (result) {
      await this.actions.groupMessages(ids, session.id, result);
      this.toggleSelectionMode();

      this.snackBar.open('Context grouped successfully', 'Close', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
      });
    }
  }

  async excludeSelected(exclude: boolean) {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    await this.actions.toggleExcludeSelected(ids, exclude);
    this.toggleSelectionMode();
  }

  async deleteSelected() {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    await this.actions.deleteSelected(ids);
    this.toggleSelectionMode();
  }

  async onEditSelected() {
    const selectedSet = this.selectedIds();
    if (selectedSet.size !== 1) return;

    const messageIdStr = Array.from(selectedSet)[0];
    const messageId = URN.parse(messageIdStr);

    const item = this.source
      .items()
      .find(
        (i) =>
          i.type === 'content' && (i.data as LlmMessage).id.equals(messageId),
      );

    if (!item || item.type !== 'content') return;

    const msgData = item.data as LlmMessage;
    const decoder = new TextDecoder();
    const currentText = msgData.payloadBytes
      ? decoder.decode(msgData.payloadBytes)
      : '';

    if (currentText.startsWith('{"__type":"workspace_proposal"')) {
      this.snackBar.open('Cannot directly edit workspace proposals.', 'Close', {
        duration: 3000,
      });
      return;
    }

    const dialogRef = this.dialog.open(LlmEditMessageDialogComponent, {
      width: '600px',
      data: {
        content: currentText,
        role: msgData.role,
      },
    });

    dialogRef.afterClosed().subscribe(async (newText: string | undefined) => {
      if (newText !== undefined && newText !== currentText) {
        await this.actions.updateMessageText(messageIdStr, newText);
        this.toggleSelectionMode();
      }
    });
  }
}
