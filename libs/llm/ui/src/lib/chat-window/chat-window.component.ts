import {
  Component,
  inject,
  effect,
  signal,
  untracked,
  computed,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { Temporal } from '@js-temporal/polyfill';

import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { URN } from '@nx-platform-application/platform-types';

import {
  ScrollspaceViewportComponent,
  ScrollspaceInputComponent,
  ScrollspaceMarkdownBubbleComponent,
  MarkdownTokensPipe,
} from '@nx-platform-application/scrollspace-ui';

import { LlmMessage } from '@nx-platform-application/llm-types';
import { ScrollspaceInputDraft } from '@nx-platform-application/scrollspace-types';

import {
  LlmScrollSource,
  LlmSessionSource,
} from '@nx-platform-application/llm-features-chat';
import { LlmChatActions } from '@nx-platform-application/llm-domain-conversation';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-session';
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';

// NEW IMPORT
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';

import { LlmContentPipe } from '../pipes/llm-content.pipe';
import { LlmChatHeaderComponent } from '../chat-header/chat-header.component';

import {
  GroupContextDialogComponent,
  GroupContextDialogResult,
} from '../group-context-dialog/group-context-dialog.component';
import {
  BranchContextDialogComponent,
  BranchContextDialogResult,
} from '../branch-context-dialog/branch-context-dialog.component';

import { LlmEditMessageDialogComponent } from '../edit-message-dialog/edit-message-dialog.component';

import { LlmProposalBubbleComponent } from '../proposal-bubble/proposal-bubble.component';
import { LlmFileLinkBubbleComponent } from '../file-link-bubble/file-link-bubble.component';
import { LlmTypingIndicatorComponent } from '../typing-indicator/typing-indicator.component';
import { LlmQuickContextDrawerComponent } from '../quick-context-drawer/quick-context-drawer.component';

@Component({
  selector: 'llm-chat-window',
  standalone: true,
  imports: [
    CommonModule,
    ScrollspaceViewportComponent,
    ScrollspaceInputComponent,
    ScrollspaceMarkdownBubbleComponent,
    MatIcon,
    MarkdownTokensPipe,
    LlmChatHeaderComponent,
    LlmContentPipe,
    LlmProposalBubbleComponent,
    LlmFileLinkBubbleComponent,
    LlmTypingIndicatorComponent,
    LlmQuickContextDrawerComponent,
  ],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
})
export class LlmChatWindowComponent {
  protected source = inject(LlmScrollSource);
  private sessionSource = inject(LlmSessionSource);
  private actions = inject(LlmChatActions);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private sessionActions = inject(LlmSessionActions);
  private proposalService = inject(LlmProposalService);
  private cdr = inject(ChangeDetectorRef);

  // NEW INJECT
  private cacheService = inject(CompiledCacheService);

  copiedMessageId = signal<string | null>(null);
  isSelectionMode = signal(false);
  selectedIds = signal<Set<string>>(new Set());
  focusedGroupUrn = signal<string | null>(null);

  readonly session = computed(() => this.sessionSource.activeSession());

  readonly activeContextGroups = computed(
    () => this.session()?.contextGroups || {},
  );

  chatLockState = computed(() => {
    const session = this.session();
    if (!session) return { locked: false, reason: '' };

    // Swapped to global compiling state
    if (this.cacheService.isCompiling()) {
      return {
        locked: true,
        reason: '⚙️ Compiling context cache... please wait.',
      };
    }

    return { locked: false, reason: '' };
  });

  chatAlertState = computed(() => {
    const session = this.session();
    if (!session) return { alert: false, reason: '' };

    // Swapped to global compiling state
    if (this.cacheService.isCompiling()) {
      return {
        alert: true,
        reason: '⚙️ Compiling context cache... please wait.',
      };
    }

    if (session.compiledCache?.expiresAt) {
      const now = Temporal.Now.instant();
      const expiry = Temporal.Instant.from(session.compiledCache.expiresAt);

      if (Temporal.Instant.compare(now, expiry) >= 0) {
        return {
          alert: true,
          reason:
            '⏰ Context cache expired. Responses will be slower. Please renew in Settings.',
        };
      }
    }

    return { alert: false, reason: '' };
  });

  constructor() {
    effect(() => {
      const activeId = this.sessionSource.activeSessionId();
      if (activeId) {
        untracked(() => this.source.setSession(activeId));
      }
    });
  }

  // ... (Rest of the component methods remain exactly the same)
  onOpenDetails() {
    this.router.navigate([], {
      queryParams: { view: 'details' },
      queryParamsHandling: 'merge',
    });
  }

  toggleSelectionMode() {
    this.isSelectionMode.set(!this.isSelectionMode());
    this.selectedIds.set(new Set());
  }

  collapsedBlocks = computed(() => {
    const focusUrn = this.focusedGroupUrn();
    const items = this.source.items();
    const blocks: Record<string, { count: number; isFirst: boolean }> = {};

    if (!focusUrn) return blocks;

    let currentBlockCount = 0;
    let firstIdInBlock: string | null = null;

    for (const item of items) {
      const msg = item.data;
      const isValidMsg = msg && typeof msg !== 'string';

      if (isValidMsg && !this.isMessageInFocus(msg)) {
        if (currentBlockCount === 0) {
          firstIdInBlock = msg.id.toString();
        }
        currentBlockCount++;
        blocks[msg.id.toString()] = { count: 0, isFirst: false };
      } else {
        if (currentBlockCount > 0 && firstIdInBlock) {
          blocks[firstIdInBlock] = { count: currentBlockCount, isFirst: true };
          currentBlockCount = 0;
          firstIdInBlock = null;
        }
      }
    }

    if (currentBlockCount > 0 && firstIdInBlock) {
      blocks[firstIdInBlock] = { count: currentBlockCount, isFirst: true };
    }

    return blocks;
  });

  displayItems = computed(() => {
    const focusUrn = this.focusedGroupUrn();
    const items = this.source.items();
    const blocks = this.collapsedBlocks();

    if (!focusUrn) return items;

    return items.filter((item) => {
      const msg = item.data;
      if (!msg || typeof msg === 'string') return true;
      if (this.isMessageInFocus(msg)) return true;

      const blockMeta = blocks[msg.id.toString()];
      return blockMeta && blockMeta.isFirst;
    });
  });

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
        currentId,
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

  async groupSelected() {
    const ids = Array.from(this.selectedIds());
    const session = this.session();
    if (!session) return;

    const existingGroups = Object.entries(this.activeContextGroups()).map(
      ([urn, name]) => ({
        urn,
        name,
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

  onSend(draft: ScrollspaceInputDraft) {
    if (!draft.text) return;
    const currentId = this.source.activeSessionId();
    if (currentId) {
      this.actions.sendMessage(draft.text, currentId);
    }
  }

  onStop() {
    this.actions.cancelGeneration();
    const snackbarRef = this.snackBar.open(
      'You canceled the response.',
      'Save',
      { duration: 5000 },
    );
    snackbarRef.afterDismissed().subscribe((info) => {
      if (info.dismissedByAction) {
        this.actions.resolveCancellation('save');
      } else {
        this.actions.resolveCancellation('delete');
      }
    });
  }

  private executeWithTransition(updateFn: () => void) {
    if (!document.startViewTransition) {
      updateFn();
      return;
    }
    document.startViewTransition(() => {
      updateFn();
      this.cdr.detectChanges();
    });
  }

  async onAcceptProposal(proposalId: string) {
    const session = this.session();
    if (!session) return;
    await this.proposalService.acceptProposal(proposalId);
  }

  async onRejectProposal(proposalId: string, messageId: string) {
    const session = this.session();
    if (!session) return;
    await this.proposalService.rejectProposal(proposalId);
    await this.actions.toggleExcludeSelected([messageId], true);
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

  async copyMessage(text: string, messageId: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedMessageId.set(messageId);
      setTimeout(() => {
        if (this.copiedMessageId() === messageId) {
          this.copiedMessageId.set(null);
        }
      }, 2000);
    } catch (err) {
      console.error('Failed to copy message', err);
    }
  }

  onOpenWorkspace(proposalId?: string) {
    const session = this.session();
    if (!session) return;

    const queryParams: Record<string, string> = { view: 'workspace' };
    if (proposalId) {
      queryParams['proposal'] = proposalId;
    }

    this.router.navigate([], {
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
