import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

// Domain / State
import { WorkspaceStateService } from '@nx-platform-application/llm-features-workspace';
import { LlmSessionSource } from '@nx-platform-application/llm-features-session';
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';

// Child Components
import {
  LlmWorkspaceSidebarComponent,
  WorkspaceSidebarFile,
} from '../workspace-sidebar/workspace-sidebar.component';
import { LlmWorkspaceFileViewerComponent } from '../workspace-file-viewer/workspace-file-viewer.component';
import { LlmSessionSubpageHeaderComponent } from '../session-subpage-header/session-subpage-header.component';
import { LlmPatchClipboardDialogComponent } from '../patch-clipboard-dialog/patch-clipboard-dialog.component';

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
  private proposalActions = inject(LlmProposalService);
  private sessionSource = inject(LlmSessionSource);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  // --- INPUTS & OUTPUTS ---
  readonly activeSession = computed(() => this.sessionSource.activeSession());
  closed = output<void>();

  // --- LOCAL UI STATE ---
  selectedFilePath = signal<string | null>(null);
  selectedProposalId = signal<string | null>(null);

  hasStagedChanges = computed(() => this.workspaceState.hasStagedChanges());

  hasPendingChanges = computed(() => {
    for (const record of this.workspaceState.overlayMap().values()) {
      if (record.proposalChain.some((p) => p.status === 'pending')) return true;
    }
    return false;
  });

  constructor() {
    // 1. URL Initialization: Auto-select proposal from query params
    effect(() => {
      const proposalId = this.route.snapshot.queryParamMap.get('proposal');
      if (proposalId) {
        for (const [path, record] of this.workspaceState
          .overlayMap()
          .entries()) {
          const hasProposal = record.proposalChain.some(
            (p) => p.id === proposalId,
          );

          if (hasProposal) {
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

  // --- COMPUTED: VIEW MODELS ---

  sidebarFiles = computed<WorkspaceSidebarFile[]>(() => {
    const files: WorkspaceSidebarFile[] = [];
    const conflicts = this.workspaceState.conflictsMap();

    this.workspaceState.overlayMap().forEach((record, path) => {
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

  activeChain = computed(() => this.activeRecord()?.proposalChain ?? []);

  // --- THE UNIFIED RESOLUTION SIGNAL ---
  // Calculates the diff chain ONCE per change, saving all properties (content, error, healedPatch).
  readonly resolution = computed(() => {
    const record = this.activeRecord();
    if (!record) return null;
    return this.workspaceState.resolveChainState(
      record,
      this.selectedProposalId(),
    );
  });

  // Derived signals for the UI bindings
  readonly displayContent = computed(() => this.resolution()?.content ?? null);
  readonly displayError = computed(() => this.resolution()?.error);
  readonly healedPatch = computed(() => this.resolution()?.healedPatch);
  readonly failedProposalId = computed(
    () => this.resolution()?.failedProposalId,
  );

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
    this.selectedProposalId.set(null);
    this.workspaceState.loadContent(path);
  }

  onPreviewSelected(proposalId: string | null): void {
    this.selectedProposalId.set(proposalId);
  }

  viewStagedPatch(): void {
    const patchString = this.workspaceState.generateStagedPatch();
    this.dialog.open(LlmPatchClipboardDialogComponent, {
      width: '800px',
      data: { patch: patchString },
    });
  }

  async onStageProposal(proposalId: string): Promise<void> {
    const record = this.activeRecord();
    if (!record) return;

    const targetIndex = record.proposalChain.findIndex(
      (p) => p.id === proposalId,
    );
    if (targetIndex === -1) return;

    const idsToStage = record.proposalChain
      .slice(0, targetIndex + 1)
      .filter((p) => p.status === 'pending')
      .map((p) => p.id);

    await this.proposalActions.updateProposalStatuses(idsToStage, 'staged');
  }

  async onAcceptProposal(proposalId: string): Promise<void> {
    await this.proposalActions.acceptProposal(proposalId);
    if (this.selectedProposalId() === proposalId) {
      this.selectedProposalId.set(null);
    }
  }

  async onRejectProposal(proposalId: string): Promise<void> {
    await this.proposalActions.rejectProposal(proposalId);
    if (this.selectedProposalId() === proposalId) {
      this.selectedProposalId.set(null);
    }
  }

  async onStageAll(): Promise<void> {
    const idsToStage: string[] = [];
    this.workspaceState.overlayMap().forEach((record) => {
      record.proposalChain.forEach((p) => {
        if (p.status === 'pending') idsToStage.push(p.id);
      });
    });
    await this.proposalActions.updateProposalStatuses(idsToStage, 'staged');
  }

  async onUnstageAll(): Promise<void> {
    const idsToUnstage: string[] = [];
    this.workspaceState.overlayMap().forEach((record) => {
      record.proposalChain.forEach((p) => {
        if (p.status === 'staged') idsToUnstage.push(p.id);
      });
    });
    await this.proposalActions.updateProposalStatuses(idsToUnstage, 'pending');
  }

  async onHealProposal(event: { proposalId: string; patch: string }) {
    await this.proposalActions.healProposalPatch(event.proposalId, event.patch);
    this.snackBar.open('Diff successfully healed and updated.', 'Close', {
      duration: 3000,
    });
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
