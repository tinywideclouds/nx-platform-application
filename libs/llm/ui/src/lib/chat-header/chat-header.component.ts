import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ConfirmationDialogComponent,
  ConfirmationData,
} from '@nx-platform-application/platform-ui-toolkit';

@Component({
  selector: 'llm-chat-header',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatDialogModule, MatTooltipModule],
  templateUrl: './chat-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmChatHeaderComponent {
  private dialog = inject(MatDialog);

  // State Inputs
  isGenerating = input<boolean>(false);
  isSelectionMode = input<boolean>(false);
  selectedCount = input<number>(0);

  // Action Outputs
  toggleSelection = output<void>();
  groupContext = output<void>();
  excludeContext = output<void>();
  includeContext = output<void>();
  deleteContext = output<void>();
  editContext = output<void>(); // NEW

  // Toolbar Outputs replacing openDetails
  openFiles = output<void>();
  openDetails = output<void>();

  confirmDelete(): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '450px',
      data: {
        title: 'Delete Messages',
        message: `Are you sure you want to permanently delete ${this.selectedCount()} selected message(s)?\n\nTip: If you just want to hide this from the AI's memory, click "Cancel" and use the "Exclude" button instead.`,
        confirmText: 'Delete Permanently',
        confirmColor: 'warn',
        icon: 'warning',
      } as ConfirmationData,
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.deleteContext.emit();
      }
    });
  }
}
