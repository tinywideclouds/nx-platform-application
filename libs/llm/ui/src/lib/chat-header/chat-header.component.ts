import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  signal,
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
  sessionTitle = input<string | undefined>(undefined);
  activeModelId = input<string | undefined>(undefined);

  // NEW: Ephemeral Thought State
  activeThought = input<string>('');

  alertState = input<{ alert: boolean; reason: string }>({
    alert: false,
    reason: '',
  });

  overrideRemaining = input<number | null>(null);

  // Action Outputs
  toggleSelection = output<void>();
  groupContext = output<void>();
  excludeContext = output<void>();
  includeContext = output<void>();
  deleteContext = output<void>();
  editContext = output<void>();
  openFiles = output<void>();
  openDetails = output<void>();

  // UI State for Ticker Tape
  showThoughts = signal(false);
  isThinking = computed(() => this.activeThought().length > 0);

  primaryModelLabel = computed(() => {
    const id = this.activeModelId();
    if (!id) return '';
    if (id.includes('pro')) return 'Gemini Pro';
    if (id.includes('flash-lite')) return 'Flash Lite';
    if (id.includes('flash')) return 'Gemini Flash';
    return id;
  });

  toggleThoughts() {
    this.showThoughts.update((v) => !v);
  }

  confirmDelete(): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '450px',
      data: {
        title: 'Delete Messages',
        message: `Are you sure you want to permanently delete ${this.selectedCount()} selected message(s)?`,
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
