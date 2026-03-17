import {
  Component,
  inject,
  output,
  input,
  signal,
  computed,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { URN } from '@nx-platform-application/platform-types';
import { LlmDigestSource } from '@nx-platform-application/llm-features-memory';

import {
  ConfirmationDialogComponent,
  ConfirmationData,
} from '@nx-platform-application/platform-ui-toolkit';

import {
  LlmDigestService,
  StandardPrompt,
  ArchitecturalPrompt,
  DebugPrompt,
  MinimalPrompt,
} from '@nx-platform-application/llm-domain-digest';

@Component({
  selector: 'llm-memory-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatDialogModule,
    DatePipe,
  ],
  templateUrl: './memory-sidebar.component.html',
})
export class LlmMemorySidebarComponent {
  source = inject(LlmDigestSource);
  // --- CHANGED: Inject Domain Service ---
  private digestService = inject(LlmDigestService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  selectedDigestId = input<URN | null>(null);
  openBuilder = output<void>();
  selectDigest = output<URN>();

  // --- UI State ---
  isEditMode = signal(false);
  selectedForDeletion = signal<Set<string>>(new Set());

  // --- Filter State ---
  activeFilter = signal<string>('ALL');

  filterOptions = [
    { label: 'All Types', value: 'ALL' },
    { label: 'Standard', value: StandardPrompt.toString() },
    { label: 'Architectural', value: ArchitecturalPrompt.toString() },
    { label: 'Debugging', value: DebugPrompt.toString() },
    { label: 'Minimal', value: MinimalPrompt.toString() },
  ];

  filteredDigests = computed(() => {
    // Sort chronologically by the time the actual conversation happened (Newest chat events at the top)
    const digests = [...this.source.digests()].sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );

    const filter = this.activeFilter();

    if (filter === 'ALL') return digests;
    return digests.filter((d) => d.typeId.toString() === filter);
  });

  // --- Chip Helpers ---
  getPromptDisplayName(typeId: URN): string {
    const idStr = typeId.toString();
    if (idStr === ArchitecturalPrompt.toString()) return 'Architectural';
    if (idStr === DebugPrompt.toString()) return 'Debugging';
    if (idStr === MinimalPrompt.toString()) return 'Minimal';
    return 'Standard';
  }

  getPromptColorClass(typeId: URN): string {
    const idStr = typeId.toString();
    if (idStr === ArchitecturalPrompt.toString())
      return 'bg-purple-100 text-purple-800 border-purple-200';
    if (idStr === DebugPrompt.toString())
      return 'bg-orange-100 text-orange-800 border-orange-200';
    if (idStr === MinimalPrompt.toString())
      return 'bg-gray-100 text-gray-800 border-gray-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  }

  toggleEditMode() {
    this.isEditMode.set(!this.isEditMode());
    this.selectedForDeletion.set(new Set());
  }

  onDigestClick(digestId: URN) {
    if (this.isEditMode()) {
      const current = new Set(this.selectedForDeletion());
      const idStr = digestId.toString();
      if (current.has(idStr)) current.delete(idStr);
      else current.add(idStr);
      this.selectedForDeletion.set(current);
    } else {
      this.selectDigest.emit(digestId);
    }
  }

  confirmDelete(): void {
    const count = this.selectedForDeletion().size;
    if (count === 0) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '450px',
      data: {
        title: 'Delete Digests',
        message: `Are you sure you want to permanently delete ${count} selected memory digest(s)?`,
        confirmText: 'Delete',
        confirmColor: 'warn',
        icon: 'warning',
      } as ConfirmationData,
    });

    dialogRef.afterClosed().subscribe(async (confirmed: boolean) => {
      if (confirmed) {
        try {
          const idsToDelete = Array.from(this.selectedForDeletion());
          for (const idStr of idsToDelete) {
            // --- CHANGED: Use Domain Service ---
            await this.digestService.deleteDigest(URN.parse(idStr));
          }

          this.snackBar.open(`Deleted ${count} digest(s)`, 'Close', {
            duration: 3000,
          });
          this.source.refresh(); // Tell the UI to update
          this.toggleEditMode(); // Exit edit mode

          // If we deleted the currently viewed digest, clear the selection
          if (
            this.selectedDigestId() &&
            idsToDelete.includes(this.selectedDigestId()!.toString())
          ) {
            this.selectDigest.emit(null as any);
          }
        } catch (e) {
          console.error('Failed to delete digests', e);
          this.snackBar.open('Failed to delete digests', 'Close', {
            duration: 3000,
          });
        }
      }
    });
  }
}
