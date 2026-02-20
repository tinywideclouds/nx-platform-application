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
import {
  ConfirmationDialogComponent,
  ConfirmationData,
} from '@nx-platform-application/platform-ui-toolkit';

@Component({
  selector: 'llm-chat-header',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatDialogModule],
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
  extractContext = output<void>();
  excludeContext = output<void>();
  includeContext = output<void>();
  deleteContext = output<void>();
  openDetails = output<void>();

  confirmDelete(): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Messages',
        message: `Are you sure you want to permanently delete ${this.selectedCount()} selected message(s)? This cannot be undone.`,
        confirmText: 'Delete',
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
