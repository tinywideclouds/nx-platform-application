import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Domain Imports
import { CloudSyncService } from '@nx-platform-application/messenger-cloud-sync';

@Component({
  selector: 'lib-messenger-sync-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
  ],
  templateUrl: './messenger-sync-card.component.html',
  styleUrl: './messenger-sync-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerSyncCardComponent {
  private syncService = inject(CloudSyncService);
  private snackBar = inject(MatSnackBar);

  // --- Local UI State ---
  syncContacts = signal(true);
  syncMessages = signal(true);

  // --- Delegated Service State ---
  isSyncing = this.syncService.isSyncing;
  lastResult = this.syncService.lastSyncResult;

  async triggerSync(): Promise<void> {
    const providerId = 'google'; // Future: Injectable token

    try {
      // 1. Explicit Connection (Directly attached to the click event)
      // FIX: We now pass the user's intent (contacts/messages) so the service
      // can request ALL necessary scopes in this single user-gesture window.
      if (!this.syncService.hasPermission(providerId)) {
        const authorized = await this.syncService.connect(providerId, {
          syncContacts: this.syncContacts(),
          syncMessages: this.syncMessages(),
        });

        if (!authorized) {
          // User cancelled or closed the popup
          return;
        }
      }

      // 2. Background Sync (Safe to run async)
      // The auth token is now cached with the correct scopes.
      const result = await this.syncService.syncNow({
        providerId,
        syncContacts: this.syncContacts(),
        syncMessages: this.syncMessages(),
      });

      if (result.success) {
        this.snackBar.open('Sync completed successfully', 'Close', {
          duration: 3000,
        });
      } else {
        this.snackBar.open('Sync encountered errors', 'Close', {
          duration: 5000,
        });
      }
    } catch (e) {
      this.snackBar.open('Unexpected error during sync', 'Close');
    }
  }
}
