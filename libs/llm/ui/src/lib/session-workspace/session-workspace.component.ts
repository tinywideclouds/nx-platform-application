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

// Domain / State
import { WorkspaceStateService } from '@nx-platform-application/llm-features-workspace';
import { LlmSessionActions } from '@nx-platform-application/llm-domain-conversation';

// Child Components
import {
  LlmWorkspaceSidebarComponent,
  WorkspaceSidebarFile,
} from '../workspace-sidebar/workspace-sidebar.component';
import { LlmWorkspaceFileViewerComponent } from '../workspace-file-viewer/workspace-file-viewer.component';
import { LlmSession } from '@nx-platform-application/llm-types';
import { LlmSessionSubpageHeaderComponent } from '../session-subpage-header/session-subpage-header.component';

@Component({
  selector: 'llm-session-workspace',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    LlmWorkspaceSidebarComponent,
    LlmWorkspaceFileViewerComponent,
    LlmSessionSubpageHeaderComponent,
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
    // 1. URL Initialization: Auto-select proposal from query params
    effect(() => {
      const proposalId = this.route.snapshot.queryParamMap.get('proposal');
      if (proposalId) {
        for (const [path, record] of this.workspaceState
          .overlayMap()
          .entries()) {
          // FIX: Use proposalChain instead of activeProposals
          const hasProposal = record.proposalChain.some(
            (p) => p.id === proposalId,
          );

          if (hasProposal) {
            // setTimeout to avoid cyclic updates during initial render
            setTimeout(() => {
              this.onSelectFile(path);
              this.selectedProposalId.set(proposalId);
            }, 0);
            break;
          }
        }
      }
    });

    // 2. Smart Defaults: The "Ghost" Base State Logic
    effect(() => {
      const record = this.activeRecord();

      // If the file doesn't exist in base, immediately jump to the first proposal in the chain
      // so the user sees the "New File" code instead of a blank screen.
      if (
        record &&
        record.baseContent === null &&
        record.proposalChain.length > 0 &&
        !this.selectedProposalId()
      ) {
        setTimeout(() => {
          this.selectedProposalId.set(record.proposalChain[0].id);
        }, 0);
      }
    });
  }

  // --- COMPUTED: SIDEBAR DATA ---
  // --- STRICTLY TYPED COMPUTED STATE ---

  sidebarFiles = computed<WorkspaceSidebarFile[]>(() => {
    const files: WorkspaceSidebarFile[] = [];
    const conflicts = this.workspaceState.conflictsMap();

    this.workspaceState.overlayMap().forEach((record, path) => {
      // FIX: Use proposalChain instead of activeProposals/acceptedProposals
      if (record.proposalChain.length > 0) {
        files.push({
          path,
          name: path.split('/').pop() || path,
          hasConflicts: conflicts.get(path) ?? false,
          hasPendingProposals: record.proposalChain.some(
            (p) => p.status === 'pending',
          ),
        });
      }
    });

    return files;
  });

  activeRecord = computed(() => {
    const path = this.selectedFilePath();
    if (!path) return null;
    return this.workspaceState.overlayMap().get(path) || null;
  });

  // Expose the chain for the HTML template
  activeChain = computed(() => this.activeRecord()?.proposalChain ?? []);

  // FIX: Completely rely on the Service Engine. No latestContent. No manual patching here.
  displayContent = computed(() => {
    const record = this.activeRecord();
    if (!record) return null;
    return this.workspaceState.resolveChainState(
      record,
      this.selectedProposalId(),
    ).content;
  });

  // Safely expose any sequential conflicts caught by the engine
  displayError = computed(() => {
    const record = this.activeRecord();
    if (!record) return null;
    return this.workspaceState.resolveChainState(
      record,
      this.selectedProposalId(),
    ).error;
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
