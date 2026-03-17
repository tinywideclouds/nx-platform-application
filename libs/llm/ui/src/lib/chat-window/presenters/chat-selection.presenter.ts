import { Injectable, inject, signal, effect, untracked } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { URN } from '@nx-platform-application/platform-types';
import { LlmMessage } from '@nx-platform-application/llm-types';

import { LlmScrollSource } from '@nx-platform-application/llm-features-chat';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { LlmChatActions } from '@nx-platform-application/llm-domain-conversation';
import { ChatDialogCoordinatorService } from './chat-dialog-coordinator.service';

@Injectable()
export class ChatSelectionPresenter {
  private source = inject(LlmScrollSource);
  private sessionSource = inject(LlmSessionSource);
  private actions = inject(LlmChatActions);
  private dialogs = inject(ChatDialogCoordinatorService);
  private snackBar = inject(MatSnackBar);

  isSelectionMode = signal(false);
  selectedIds = signal<Set<string>>(new Set());

  constructor() {
    // Automatically clear selection if the user switches to a different session
    effect(() => {
      const activeId = this.sessionSource.activeSessionId();
      if (activeId) {
        untracked(() => {
          this.isSelectionMode.set(false);
          this.selectedIds.set(new Set());
        });
      }
    });
  }

  toggleSelectionMode() {
    this.isSelectionMode.set(!this.isSelectionMode());
    this.selectedIds.set(new Set());
  }

  async groupSelected() {
    const ids = Array.from(this.selectedIds());
    const session = this.sessionSource.activeSession();
    if (!session) return;

    const existingGroups = Object.entries(session.contextGroups || {}).map(
      ([urn, name]) => ({ urn, name: String(name) }),
    );

    const result = await this.dialogs.openGroupContext(existingGroups);

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

    const newText = await this.dialogs.openEditMessage(
      currentText,
      msgData.role,
    );

    if (newText !== undefined && newText !== currentText) {
      await this.actions.updateMessageText(messageIdStr, newText);
      this.toggleSelectionMode();
    }
  }
}
