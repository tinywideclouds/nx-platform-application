import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'llm-migration-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-md">
      <div class="flex items-center gap-3 mb-4 text-amber-600">
        <mat-icon class="scale-125">update</mat-icon>
        <h2 class="text-xl font-bold m-0">Action Required: Workspace Update</h2>
      </div>

      <p class="text-gray-600 mb-4 leading-relaxed">
        We've detected legacy File Proposals in your chat history. We are
        rolling out a major update to the Workspace Engine to improve speed and
        cross-session diffing.
      </p>

      <div class="bg-amber-50 border border-amber-200 rounded-md p-3 mb-6">
        <span class="text-sm text-amber-900 font-medium">
          <strong>Important:</strong> On June 4th, 2026, the legacy format will
          be strictly deprecated. Any unmigrated proposals will render as plain
          text and can no longer be staged.
        </span>
      </div>

      <div class="flex justify-end gap-3">
        <button mat-button (click)="dialogRef.close(false)">
          Skip for Later
        </button>
        <button
          mat-flat-button
          color="primary"
          class="bg-indigo-600"
          (click)="dialogRef.close(true)"
        >
          Migrate Now
        </button>
      </div>
    </div>
  `,
})
export class LlmMigrationDialogComponent {
  constructor(public dialogRef: MatDialogRef<LlmMigrationDialogComponent>) {}
}
