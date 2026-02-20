import { Component, inject, input, effect, signal } from '@angular/core';
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
import { ScrollspaceInputDraft } from '@nx-platform-application/scrollspace-types';

// Domain
import {
  LlmScrollSource,
  LlmSessionSource,
} from '@nx-platform-application/llm-features-chat';
import {
  LlmChatActions,
  LlmSessionActions,
} from '@nx-platform-application/llm-domain-conversation';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmContentPipe } from '../pipes/llm-content.pipe';
import { LlmChatHeaderComponent } from '../chat-header/chat-header.component';
import {
  GroupContextDialogComponent,
  GroupContextDialogResult,
} from '../group-context-dialog/group-context-dialog.component';

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
  ],
  templateUrl: './chat-window.component.html',
})
export class LlmChatWindowComponent {
  // Services
  protected source = inject(LlmScrollSource);
  private actions = inject(LlmChatActions);
  private storage = inject(LlmStorageService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private sessionSource = inject(LlmSessionSource);
  private sessionActions = inject(LlmSessionActions);

  // ROUTER INPUT: 'urn:llm:session:...' or undefined
  // Provided by withComponentInputBinding() in app.config
  readonly sessionId = input<string>();

  isSelectionMode = signal(false);
  selectedIds = signal<Set<string>>(new Set());

  constructor() {
    // ✅ REACTIVE ROUTING LOGIC
    effect(() => {
      const idStr = this.sessionId();

      if (idStr) {
        // CASE A: Route has ID -> Hydrate Source
        try {
          const urn = URN.parse(idStr);
          this.source.setSession(urn);
        } catch (e) {
          console.error('Invalid Session URN', e);
          this.navigateToNew();
        }
      } else {
        // CASE B: No ID -> Smart Resume (Find Last or Create New)
        this.resumeLastSession();
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

  private async resumeLastSession() {
    // 1. Ask DB for recent sessions (Ordered by LastModified DESC)
    const sessions = await this.storage.getSessions();

    if (sessions.length > 0) {
      // Found one! (This catches the Scenario Seed)
      const last = sessions[0];
      this.router.navigate(['chat', last.id.toString()], { replaceUrl: true });
    } else {
      // Nothing found (Fresh Install), create new
      this.navigateToNew();
    }
  }

  private navigateToNew() {
    const newId = URN.create('session', crypto.randomUUID(), 'llm');
    this.router.navigate(['chat', newId.toString()], { replaceUrl: true });
  }

  toggleSelectionMode() {
    this.isSelectionMode.set(!this.isSelectionMode());
    this.selectedIds.set(new Set());
  }

  // --- SELECTION & BULK ACTIONS ---

  async groupSelected() {
    const ids = Array.from(this.selectedIds());
    const currentSessionId = this.source.activeSessionId();
    if (ids.length === 0 || !currentSessionId) return;

    // 1. Fetch existing groups from the currently active session
    const currentSession = this.sessionSource
      .sessions()
      .find((s) => s.id.equals(currentSessionId));

    const sessionGroups = currentSession?.contextGroups || {};
    const existingGroups = Object.entries(sessionGroups).map(([urn, name]) => ({
      urn,
      name,
    }));

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
      await this.actions.groupMessages(ids, currentSessionId, result);
      this.toggleSelectionMode(); // Reset UI

      this.snackBar.open('Context grouped successfully', 'Close', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
      });
    }
  }

  async extractSelected() {
    const ids = Array.from(this.selectedIds());
    const currentId = this.source.activeSessionId();

    if (ids.length === 0 || !currentId) return;

    try {
      // 1. Domain executes the data extraction (returns the new session URN)
      const newSessionId = await this.actions.extractToNewSession(
        ids,
        currentId,
      );

      // 2. Reset local UI
      this.toggleSelectionMode();

      // 3. Delegate routing to your dedicated session router
      this.sessionActions.openSession(newSessionId);

      this.snackBar.open('Extracted to new session', 'Close', {
        duration: 3000,
        horizontalPosition: 'end',
        verticalPosition: 'bottom',
      });
    } catch (e) {
      console.error('Extraction failed', e);
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
}
