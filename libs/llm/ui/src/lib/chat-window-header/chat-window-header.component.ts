import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  computed,
  signal,
  effect,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import {
  ConfirmationDialogComponent,
  ConfirmationData,
} from '@nx-platform-application/platform-ui-toolkit';
import { MemoryStrategyProfile } from '@nx-platform-application/llm-types';

@Component({
  selector: 'llm-chat-window-header',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatMenuModule,
  ],
  templateUrl: './chat-window-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmChatWindowHeaderComponent {
  private dialog = inject(MatDialog);

  // State Inputs
  isGenerating = input<boolean>(false);
  isSelectionMode = input<boolean>(false);
  selectedCount = input<number>(0);
  sessionTitle = input<string | undefined>(undefined);
  activeModelId = input<string | undefined>(undefined);

  activeThought = input<string>('');
  alertState = input<{ alert: boolean; reason: string }>({
    alert: false,
    reason: '',
  });
  overrideRemaining = input<number | null>(null);

  // Fast Switcher State
  memoryProfiles = input<MemoryStrategyProfile[]>([]);
  activeMemoryProfile = input<MemoryStrategyProfile | null>(null);

  // Action Outputs
  toggleSelection = output<void>();
  groupContext = output<void>();
  excludeContext = output<void>();
  includeContext = output<void>();
  deleteContext = output<void>();
  editContext = output<void>();
  openDetails = output<void>();
  profileChange = output<string>();

  // UI State
  showThoughts = signal(false);
  isStrategyMode = signal(false); // NEW: Controls the Model rollout

  isThinking = computed(() => this.activeThought().length > 0);

  primaryModelLabel = computed(() => {
    const id = this.activeModelId();
    if (!id) return '';
    if (id.includes('pro')) return 'Gemini Pro';
    if (id.includes('flash-lite')) return 'Flash Lite';
    if (id.includes('flash')) return 'Gemini Flash';
    return id;
  });

  constructor() {
    // If external selection mode turns on, close the strategy rollout
    effect(() => {
      if (this.isSelectionMode()) {
        untracked(() => this.isStrategyMode.set(false));
      }
    });
  }

  toggleThoughts() {
    this.showThoughts.update((v) => !v);
  }

  toggleStrategyMode() {
    // If opening strategy mode, tell parent to close selection mode
    if (!this.isStrategyMode() && this.isSelectionMode()) {
      this.toggleSelection.emit();
    }
    this.isStrategyMode.update((v) => !v);
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
