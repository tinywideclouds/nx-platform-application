import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SSEProposalEvent } from '@nx-platform-application/llm-types';

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
  // --- INPUTS ---
  filePath = input<string | null>(null);
  isLoading = input<boolean>(false);

  // The actual text to render in the <pre> block (computed by the parent using the diff service)
  displayContent = input<string | null>(null);

  // Conflict / Proposal Management
  activeProposals = input<SSEProposalEvent['proposal'][]>([]);
  selectedProposalId = input<string | null>(null); // null = showing 'Base/Latest'

  // --- OUTPUTS ---
  // Emits the ID of the proposal to preview, or null to view the base/latest state
  previewSelected = output<string | null>();

  acceptProposal = output<string>();
  rejectProposal = output<string>();

  // --- ACTIONS ---
  onPreviewChange(value: string | null) {
    this.previewSelected.emit(value);
  }

  onAccept(id: string) {
    this.acceptProposal.emit(id);
  }

  onReject(id: string) {
    this.rejectProposal.emit(id);
  }
}
