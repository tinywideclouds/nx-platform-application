import { Component, ChangeDetectionStrategy, inject } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmationData {
  title: string;
  message: string;
  confirmText: string;
  /** Legacy: Helper to set color to warn */
  warn?: boolean;
  /** New: Explicit color control (takes precedence over warn) */
  confirmColor?: 'primary' | 'warn' | 'accent';
  /** New: Header icon */
  icon?: string;
}

@Component({
  selector: 'lib-confirmation-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="flex items-center gap-2">
      @if (data.icon) {
      <mat-icon [class.text-warn-500]="isWarn">{{ data.icon }}</mat-icon>
      }
      <span [class.text-warn-700]="isWarn">{{ data.title }}</span>
    </h2>

    <mat-dialog-content>
      <p class="text-gray-700" [innerHTML]="data.message"></p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [color]="resolveColor" [mat-dialog-close]="true">
        {{ data.confirmText }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialogComponent {
  data = inject<ConfirmationData>(MAT_DIALOG_DATA);

  get isWarn(): boolean {
    return !!this.data.warn || this.data.confirmColor === 'warn';
  }

  get resolveColor(): string {
    return this.data.confirmColor || (this.data.warn ? 'warn' : 'primary');
  }
}
