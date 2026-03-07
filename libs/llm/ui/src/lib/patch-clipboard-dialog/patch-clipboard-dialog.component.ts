import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'llm-patch-clipboard-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="flex items-center gap-2">
      <mat-icon class="text-indigo-600">integration_instructions</mat-icon>
      Staged Unified Patch
    </h2>
    <mat-dialog-content class="mat-typography">
      <p class="text-sm text-gray-600 mb-4">
        This is the unified diff of all your staged changes. You can copy this
        to test against your local tools.
      </p>
      <div
        class="bg-gray-900 rounded-md p-4 overflow-auto max-h-96 relative group"
      >
        <button
          mat-icon-button
          class="absolute top-2 right-2 text-gray-400 hover:text-white bg-gray-800/50 opacity-0 group-hover:opacity-100 transition-opacity"
          (click)="copyToClipboard()"
        >
          <mat-icon>content_copy</mat-icon>
        </button>
        <pre class="text-sm text-green-400 font-mono m-0 leading-relaxed">{{
          patchText
        }}</pre>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
})
export class LlmPatchClipboardDialogComponent {
  data = inject(MAT_DIALOG_DATA) as { patch: string };
  private snackBar = inject(MatSnackBar);

  get patchText() {
    return this.data.patch;
  }

  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.patchText);
      this.snackBar.open('Patch copied to clipboard!', 'Close', {
        duration: 2000,
      });
    } catch (err) {
      console.error('Failed to copy', err);
    }
  }
}
