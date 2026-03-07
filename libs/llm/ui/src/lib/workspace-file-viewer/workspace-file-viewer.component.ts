import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChangeProposal } from '@nx-platform-application/llm-types';

@Component({
  selector: 'llm-workspace-file-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './workspace-file-viewer.component.html',
  styleUrl: './workspace-file-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmWorkspaceFileViewerComponent {
  filePath = input<string | null>(null);
  isLoading = input<boolean>(false);
  hasBaseContent = input<boolean>(true); // To hide base tab if it's a new file

  displayContent = input<string | null>(null);
  displayError = input<string | null | undefined>(null); // To show conflict errors cleanly
  healedPatch = input<string | undefined>(undefined); // NEW
  failedProposalId = input<string | undefined>(undefined); // NEW

  healRequested = output<{ proposalId: string; patch: string }>();

  proposalChain = input<ChangeProposal[]>([]);
  selectedProposalId = input<string | null>(null);

  previewSelected = output<string | null>();
  acceptProposal = output<string>();
  rejectProposal = output<string>();
  stageProposal = output<string>();

  // NEW: Toggle state for Applied vs Raw Diff
  viewMode = signal<'applied' | 'raw'>('applied');

  // Compute the current raw patch if in raw mode
  rawContent = computed(() => {
    if (this.viewMode() !== 'raw') return null;
    const targetId = this.selectedProposalId();
    if (!targetId) return null;
    const proposal = this.proposalChain().find((p) => p.id === targetId);
    return proposal?.patch || proposal?.newContent || null;
  });

  getTaxonomy(proposal: ChangeProposal): {
    icon: string;
    color: string;
    tooltip: string;
  } {
    // Override color/icon if it's staged
    if (proposal.status === 'staged') {
      return {
        icon: 'verified',
        color: 'text-amber-500',
        tooltip: 'Staged for Build',
      };
    }

    if (proposal.newContent) {
      if (
        this.proposalChain()[0].id === proposal.id &&
        !this.hasBaseContent()
      ) {
        return {
          icon: 'add_circle',
          color: 'text-green-600',
          tooltip: 'New File',
        };
      }
      return {
        icon: 'edit_document',
        color: 'text-purple-600',
        tooltip: 'Full Rewrite',
      };
    }
    return {
      icon: 'difference',
      color: 'text-blue-600',
      tooltip: 'Patch / Diff',
    };
  }

  getSelectedIndex(): number {
    const id = this.selectedProposalId();
    if (!id) return -1;
    return this.proposalChain().findIndex((p) => p.id === id);
  }
}
