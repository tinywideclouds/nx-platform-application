// libs/messenger/settings-ui/src/lib/secure-logout-dialog/secure-logout-dialog.component.ts

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'lib-secure-logout-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="p-6 max-w-md">
      <div class="flex items-center gap-3 mb-4 text-red-600">
        <mat-icon class="scale-150">warning</mat-icon>
        <h2 class="text-xl font-bold m-0">Wipe Data & Log Out?</h2>
      </div>

      <div class="space-y-3 text-gray-700">
        <p>
          You are about to perform a
          <strong class="text-gray-900">Secure Wipe</strong>.
        </p>
        <ul class="list-disc pl-5 space-y-1 text-sm">
          <li>All message history on this device will be deleted.</li>
          <li>Your private encryption keys will be destroyed.</li>
          <li>Your saved contacts will be removed.</li>
        </ul>
        <p
          class="text-sm bg-red-50 p-3 rounded border border-red-100 text-red-800"
        >
          This action cannot be undone. You will need to re-verify your identity
          if you log in again.
        </p>
      </div>

      <div class="mt-8 flex justify-end gap-3">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-flat-button color="warn" [mat-dialog-close]="true">
          <mat-icon>delete_forever</mat-icon>
          Wipe Everything
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecureLogoutDialogComponent {}
