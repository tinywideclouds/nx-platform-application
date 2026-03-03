import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { applyPatch } from 'diff';
import { URN } from '@nx-platform-application/platform-types';

// Domain / State
import { WorkspaceStateService } from '@nx-platform-application/llm-features-workspace';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-conversation';
import { LlmSessionSource } from '@nx-platform-application/llm-features-chat';

// Child Components
import {
  LlmWorkspaceSidebarComponent,
  WorkspaceSidebarFile,
} from '../workspace-sidebar/workspace-sidebar.component';
import { LlmWorkspaceFileViewerComponent } from '../workspace-file-viewer/workspace-file-viewer.component';
import { LlmSession } from '@nx-platform-application/llm-types';

@Component({
  selector: 'llm-session-workspace',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    LlmWorkspaceSidebarComponent,
    LlmWorkspaceFileViewerComponent,
  ],
  templateUrl: './session-workspace.component.html',
  styleUrl: './session-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmSessionWorkspaceComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private workspaceState = inject(WorkspaceStateService);
  private sessionActions = inject(LlmSessionActions);

  // --- INPUTS & OUTPUTS ---
  readonly activeSession = input.required<LlmSession>();
  closed = output<void>();

  // --- LOCAL UI STATE ---
  selectedFilePath = signal<string | null>(null);
  selectedProposalId = signal<string | null>(null); // For the preview toggle

  constructor() {
    // If a specific proposal was clicked in the chat bubble, auto-select it here
    effect(() => {
      const proposalId = this.route.snapshot.queryParamMap.get('proposal');
      if (proposalId) {
        for (const [path, record] of this.workspaceState
          .overlayMap()
          .entries()) {
          const hasProposal = record.activeProposals.some(
            (p) => p.id === proposalId,
          );
          if (hasProposal) {
            // Untracked to avoid cyclic updates during initial render
            setTimeout(() => {
              this.onSelectFile(path);
              this.selectedProposalId.set(proposalId);
            }, 0);
            break;
          }
        }
      }
    });
  }

  // --- COMPUTED: SIDEBAR DATA ---
  sidebarFiles = computed<WorkspaceSidebarFile[]>(() => {
    const files: WorkspaceSidebarFile[] = [];
    const conflicts = this.workspaceState.conflictsMap();

    this.workspaceState.overlayMap().forEach((record, path) => {
      // Only show files that have active proposals or accepted edits in this session
      if (
        record.activeProposals.length > 0 ||
        record.acceptedProposals.length > 0
      ) {
        files.push({
          path,
          name: path.split('/').pop() || path,
          hasConflicts: conflicts.get(path) ?? false,
          hasPendingProposals: record.activeProposals.length > 0,
        });
      }
    });

    return files;
  });

  // --- COMPUTED: VIEWER DATA ---

  activeRecord = computed(() => {
    const path = this.selectedFilePath();
    if (!path) return null;
    return this.workspaceState.overlayMap().get(path) || null;
  });

  // The Preview Engine: Safely applies the patch for visual inspection
  displayContent = computed(() => {
    const record = this.activeRecord();
    if (!record) return null;

    const baseText = record.latestContent;
    const previewId = this.selectedProposalId();

    // 1. Base State (No preview selected)
    if (!previewId) return baseText;

    // 2. Proposal Preview State
    const proposal = record.activeProposals.find((p) => p.id === previewId);
    if (!proposal) return baseText;

    if (proposal.newContent) {
      return proposal.newContent;
    }

    if (proposal.patch && baseText !== null) {
      const patched = applyPatch(baseText, proposal.patch);
      if (patched === false) {
        return (
          '// ERROR: This patch conflicts with the current file state and cannot be applied cleanly.\n// Please reject this proposal or review the base file.\n\n' +
          proposal.patch
        );
      }
      return patched;
    }

    return null;
  });

  canCommit = computed(() => {
    const hasConflicts = Array.from(
      this.workspaceState.conflictsMap().values(),
    ).some((c) => c);
    const hasEdits = this.workspaceState.driftScore() > 0;
    return hasEdits && !hasConflicts;
  });

  // --- ACTIONS ---

  onSelectFile(path: string): void {
    this.selectedFilePath.set(path);
    this.selectedProposalId.set(null); // Reset preview to base when switching files
    this.workspaceState.loadContent(path);
  }

  onPreviewSelected(proposalId: string | null): void {
    this.selectedProposalId.set(proposalId);
  }

  async onAcceptProposal(proposalId: string): Promise<void> {
    const session = this.activeSession();
    if (!session) return;

    await this.sessionActions.acceptProposal(session, proposalId);

    // Automatically reset the preview to base state after accepting
    if (this.selectedProposalId() === proposalId) {
      this.selectedProposalId.set(null);
    }
  }

  async onRejectProposal(proposalId: string): Promise<void> {
    const session = this.activeSession();
    if (!session) return;

    await this.sessionActions.rejectProposal(session, proposalId);

    if (this.selectedProposalId() === proposalId) {
      this.selectedProposalId.set(null);
    }
  }

  onClose(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: null, proposal: null },
      queryParamsHandling: 'merge',
    });
    this.closed.emit();
  }
}
