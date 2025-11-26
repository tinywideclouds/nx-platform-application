import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'messenger-logout-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Sign out?</h2>
    <mat-dialog-content>
      <p class="mb-3">You are signing out of your current session.</p>

      <div
        class="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-3 text-sm text-blue-900"
      >
        <mat-icon class="text-blue-500 text-base h-5 w-5 mt-0.5">info</mat-icon>
        <div>
          <strong>Data Retained:</strong> Your message history, contacts, and
          keys will <span class="underline">remain on this device</span> for
          quicker login next time.
        </div>
      </div>

      <p class="mt-4 text-xs text-gray-500">
        <strong>Shared Computer?</strong> To remove all data, cancel this and go
        to
        <span class="font-mono bg-gray-100 px-1 rounded"
          >Settings > Identity > Secure Wipe</span
        >.
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [mat-dialog-close]="true"
        data-testid="confirm-logout-button"
      >
        Sign Out
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoutDialogComponent {}
