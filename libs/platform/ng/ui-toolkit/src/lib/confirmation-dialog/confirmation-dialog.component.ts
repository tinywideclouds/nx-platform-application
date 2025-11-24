// libs/messenger/settings-ui/src/lib/confirmation-dialog/confirmation-dialog.component.ts

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface ConfirmationData {
  title: string;
  message: string;
  confirmText: string;
  warn?: boolean;
}

@Component({
  selector: 'lib-confirmation-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title [class.text-red-700]="data.warn">{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="text-gray-700">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button 
        mat-flat-button 
        [color]="data.warn ? 'warn' : 'primary'"
        [mat-dialog-close]="true"
      >
        {{ data.confirmText }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialogComponent {
  data = inject<ConfirmationData>(MAT_DIALOG_DATA);
}