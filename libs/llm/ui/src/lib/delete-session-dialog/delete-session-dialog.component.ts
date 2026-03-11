import { Component, Inject, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { LlmSession } from '@nx-platform-application/llm-types';
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';

export interface DeleteSessionResult {
  confirmed: boolean;
  clearProposals: boolean;
  clearCache: boolean;
}

@Component({
  selector: 'llm-delete-session-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
  ],
  template: `
    <h2
      mat-dialog-title
      class="!text-red-600 flex items-center gap-2 border-b pb-2"
    >
      <mat-icon>warning_amber</mat-icon> Delete Workspace Session
    </h2>

    <mat-dialog-content class="!pt-4">
      <p class="text-gray-800 font-medium">
        Are you sure you want to delete <strong>{{ data.session.title }}</strong
        >?
      </p>
      <p class="text-xs text-gray-500 mb-6">
        This will permanently remove the conversation history from your local
        device.
      </p>

      <div
        class="flex flex-col gap-3 bg-red-50/50 p-4 rounded-lg border border-red-100"
      >
        <h4 class="text-xs font-bold text-red-800 uppercase tracking-wider m-0">
          Associated Resources
        </h4>

        <mat-checkbox [(ngModel)]="clearProposals" color="warn" class="text-sm">
          <span class="text-gray-700">Clear all pending proposals</span>
        </mat-checkbox>

        <mat-checkbox
          [(ngModel)]="clearCache"
          color="warn"
          class="text-sm"
          [disabled]="!hasWarmCache()"
        >
          <div class="flex flex-col">
            <span class="text-gray-700" [class.opacity-50]="!hasWarmCache()">
              Drop Compiled Context Cache
            </span>
            @if (hasWarmCache()) {
              <span
                class="text-[10px] text-amber-600 leading-tight mt-0.5 max-w-[90%]"
              >
                Warning: If this cache is shared with other sessions, dropping
                it will force a full recompilation next time they are opened.
              </span>
            } @else {
              <span class="text-[10px] text-gray-400 leading-tight mt-0.5">
                No active cache to drop.
              </span>
            }
          </div>
        </mat-checkbox>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="!px-6 !pb-4 mt-2">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="warn" (click)="confirm()">
        Delete Session
      </button>
    </mat-dialog-actions>
  `,
})
export class LlmDeleteSessionDialogComponent {
  private cacheService = inject(CompiledCacheService);

  clearProposals = true;
  clearCache = false;

  // FIX: Logic to check if the intent currently has a valid warm physical artifact
  readonly hasWarmCache = computed(() => {
    const session = this.data.session;
    if (!session.compiledContext || !session.llmModel) return false;

    // Simplistic check: is there ANY cache matching the model and the intent entity ID?
    return !!this.cacheService
      .activeCaches()
      .find(
        (c) =>
          c.model === session.llmModel &&
          c.id
            .toString()
            .includes(session.compiledContext!.resourceUrn.entityId),
      );
  });

  constructor(
    public dialogRef: MatDialogRef<LlmDeleteSessionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { session: LlmSession },
  ) {}

  confirm() {
    this.dialogRef.close({
      confirmed: true,
      clearProposals: this.clearProposals,
      clearCache: this.clearCache,
    } as DeleteSessionResult);
  }
}
