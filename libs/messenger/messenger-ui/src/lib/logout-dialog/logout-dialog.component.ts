// libs/messenger/messenger-ui/src/lib/logout-dialog/logout-dialog.component.ts

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'messenger-logout-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Log out and clear data?</h2>
    <mat-dialog-content>
      <p>
        <strong>Warning:</strong> This will remove all message history, contacts, 
        and encryption keys from this device.
      </p>
      <p class="mt-2 text-sm text-gray-600">
        Because this is a secure, local-first application, your data is not stored 
        on our servers. <strong>This action cannot be undone.</strong>
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button 
        mat-flat-button 
        color="warn" 
        [mat-dialog-close]="true"
        data-testid="confirm-logout-button"
      >
        Log Out & Delete Data
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoutDialogComponent {}