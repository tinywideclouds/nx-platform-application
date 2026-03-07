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
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { URN } from '@nx-platform-application/platform-types';

// UI
import {
  ScrollspaceViewportComponent,
  ScrollspaceInputComponent,
  ScrollspaceMarkdownBubbleComponent,
  MarkdownTokensPipe,
} from '@nx-platform-application/scrollspace-ui';

import { LlmMessage } from '@nx-platform-application/llm-types';
import { ScrollspaceInputDraft } from '@nx-platform-application/scrollspace-types';

// Domain
import {
  LlmScrollSource,
  LlmSessionSource,
} from '@nx-platform-application/llm-features-chat';
import { LlmChatActions } from '@nx-platform-application/llm-domain-conversation';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-session';
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
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';
import { Temporal } from '@js-temporal/polyfill';

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
  ],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
})
export class LlmChatWindowComponent {
  // Services
  protected source = inject(LlmScrollSource);

  private sessionSource = inject(LlmSessionSource);
  private actions = inject(LlmChatActions);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private sessionActions = inject(LlmSessionActions);

  private proposalService = inject(LlmProposalService);

  private cdr = inject(ChangeDetectorRef);

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

    const isCompiling = this.sessionActions.isCompiling(
      session.id.toString(),
    )();
    if (isCompiling) {
      return {
        locked: true,
        reason: '⚙️ Compiling context cache... please wait.',
      };
    }

    // Check for "Cache Drift" (attachments exist, but no cache ID generated)
    // Note: Safe navigation `?` added in case legacy sessions have no attachments array
    const needsCompile =
      session.attachments?.some((a) => a.target === 'compiled-cache') &&
      !session.compiledCache;

    if (needsCompile) {
      return {
        locked: true,
        reason: '⚠️ Context changed. Please compile the cache in Settings.',
      };
    }

    return { locked: false, reason: '' };
  });

  constructor() {
    // NEW: The chat window manages its own scroll source hydration
    effect(() => {
      const activeId = this.sessionSource.activeSessionId();
      if (activeId) {
        // Untracked so we don't accidentally re-trigger if setSession mutates something locally
        untracked(() => this.source.setSession(activeId));
      }
    });
  }

  onOpenDetails() {
    // Uses queryParamsHandling: 'merge' to keep the sessionId intact
    this.router.navigate([], {
      queryParams: { view: 'details' },
      queryParamsHandling: 'merge',
    });
  }

  toggleSelectionMode() {
    this.isSelectionMode.set(!this.isSelectionMode());
    this.selectedIds.set(new Set());
  }

  // NEW: Calculate contiguous blocks of hidden messages
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

      // If it's a valid message and NOT part of the focused group
      if (isValidMsg && !this.isMessageInFocus(msg)) {
        if (currentBlockCount === 0) {
          firstIdInBlock = msg.id.toString();
        }
        currentBlockCount++;
        // Default to not-first; we overwrite the actual first one on commit
        blocks[msg.id.toString()] = { count: 0, isFirst: false };
      } else {
        // We hit a focused message or a date header -> Commit the hidden block
        if (currentBlockCount > 0 && firstIdInBlock) {
          blocks[firstIdInBlock] = { count: currentBlockCount, isFirst: true };
          currentBlockCount = 0;
          firstIdInBlock = null;
        }
      }
    }

    // Tail commit (if the chat ends on a hidden block)
    if (currentBlockCount > 0 && firstIdInBlock) {
      blocks[firstIdInBlock] = { count: currentBlockCount, isFirst: true };
    }

    return blocks;
  });

  // NEW: The filtered array fed to the viewport
  displayItems = computed(() => {
    const focusUrn = this.focusedGroupUrn();
    const items = this.source.items();
    const blocks = this.collapsedBlocks();

    if (!focusUrn) return items;

    return items.filter((item) => {
      const msg = item.data;
      // Keep date headers and system spacers
      if (!msg || typeof msg === 'string') return true;
      // Keep focused messages
      if (this.isMessageInFocus(msg)) return true;

      // For hidden messages, ONLY keep the first one of the block to act as the pill
      const blockMeta = blocks[msg.id.toString()];
      return blockMeta && blockMeta.isFirst;
    });
  });
  // --- SELECTION & BULK ACTIONS ---

  // --- FOCUS ACTIONS ---

  focusGroup(urnString: string) {
    this.executeWithTransition(() => {
      if (this.focusedGroupUrn() === urnString) {
        this.focusedGroupUrn.set(null); // Second click cancels focus
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
    // Guard against null, strings (date headers), and messages without tags
    if (!focusUrn || !message || typeof message === 'string' || !message.tags)
      return false;

    return message.tags.some((t: URN) => t.toString() === focusUrn);
  }

  async extractFocusedGroup() {
    const focusUrn = this.focusedGroupUrn();
    const currentId = this.source.activeSessionId();

    if (!focusUrn || !currentId) return;

    // Safely extract the IDs for the focused group
    const ids = this.source
      .items()
      .map((item) => item.data)
      .filter(
        (msg): msg is LlmMessage =>
          !!msg && typeof msg !== 'string' && this.isMessageInFocus(msg),
      )
      .map((m) => m.id.toString());

    if (ids.length === 0) return;

    // 1. Ask the user for their preference (Copy vs Move)
    const dialogRef = this.dialog.open<
      BranchContextDialogComponent,
      any,
      BranchContextDialogResult
    >(BranchContextDialogComponent, { width: '450px' });

    const result = await dialogRef.afterClosed().toPromise();
    if (!result) return; // User cancelled

    try {
      // 2. Execute the action with the selected mode
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

    // 2. Open the Dialog
    const dialogRef = this.dialog.open<
      GroupContextDialogComponent,
      { existingGroups: { urn: string; name: string }[] },
      GroupContextDialogResult
    >(GroupContextDialogComponent, {
      width: '400px',
      data: { existingGroups },
    });

    const result = await dialogRef.afterClosed().toPromise();

    // 3. Dispatch action if confirmed
    if (result) {
      await this.actions.groupMessages(ids, session.id, result);
      this.toggleSelectionMode(); // Reset UI

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

  // --- UI INTERACTION ---

  onSend(draft: ScrollspaceInputDraft) {
    if (!draft.text) return;

    // Safety: Only send if we have a valid resolved session in the source
    const currentId = this.source.activeSessionId();
    if (currentId) {
      this.actions.sendMessage(draft.text, currentId);
    }
  }

  onStop() {
    // 1. Immediately halt the network
    this.actions.cancelGeneration();

    // 2. Prompt the user
    const snackbarRef = this.snackBar.open(
      'You canceled the response.',
      'Save', // The Action button
      { duration: 5000 }, // Auto-dismiss after 5 seconds
    );

    // 3. Listen for their decision
    snackbarRef.afterDismissed().subscribe((info) => {
      if (info.dismissedByAction) {
        // They explicitly clicked "Save"
        this.actions.resolveCancellation('save');
      } else {
        // They ignored it / it timed out / clicked away -> Default to Delete
        this.actions.resolveCancellation('delete');
      }
    });
  }

  // view logic
  // --- View Transition Wrapper ---
  private executeWithTransition(updateFn: () => void) {
    // Check if the browser supports the modern View Transitions API
    if (!document.startViewTransition) {
      updateFn();
      return;
    }

    document.startViewTransition(() => {
      updateFn();
      // Force Angular to update the DOM synchronously so the browser
      // can capture the "After" state for the smooth morphing animation.
      this.cdr.detectChanges();
    });
  }

  async onAcceptProposal(proposalId: string) {
    const session = this.session();
    if (!session) return;

    // Delegate to the global diff registry action
    await this.proposalService.acceptProposal(proposalId);
  }

  async onRejectProposal(proposalId: string, messageId: string) {
    const session = this.session();
    if (!session) return;

    // 1. Clear the backend ephemeral queue
    await this.proposalService.rejectProposal(proposalId);
    // 2. Exclude from local context so it doesn't waste tokens on the next prompt
    await this.actions.toggleExcludeSelected([messageId], true);
  }

  async onEditSelected() {
    const selectedSet = this.selectedIds();
    if (selectedSet.size !== 1) return;

    const messageIdStr = Array.from(selectedSet)[0];
    const messageId = URN.parse(messageIdStr);

    // Find the actual message in our current view model
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

    // Prevent editing of complex JSON proposals via the raw text editor
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
        // Clear selection to return to normal chat view
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
    console.log('opening workspace');

    const session = this.session();

    if (!session) return;

    const queryParams: Record<string, string> = { view: 'workspace' };

    // If they clicked a specific proposal bubble, pass it along to pre-select it
    if (proposalId) {
      queryParams['proposal'] = proposalId;
    }

    this.router.navigate([], {
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  chatAlertState = computed(() => {
    const session = this.session();
    if (!session) return { alert: false, reason: '' };

    const isCompiling = this.sessionActions.isCompiling(
      session.id.toString(),
    )();
    if (isCompiling) {
      return {
        alert: true,
        reason: '⚙️ Compiling context cache... please wait.',
      };
    }

    const hasCacheTarget = session.attachments?.some(
      (a) => a.target === 'compiled-cache',
    );

    if (hasCacheTarget && !session.compiledCache) {
      return {
        alert: true,
        reason: '⚠️ Context changed. Please compile the cache in Settings.',
      };
    }

    // NEW: Check if the cache is mathematically expired!
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
}
