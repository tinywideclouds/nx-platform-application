// libs/messenger/settings-ui/src/lib/messenger-sync-card/messenger-sync-card.component.ts

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
import { ChatService } from '@nx-platform-application/chat-state';

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
  // 1. Inject Orchestrator for ACTIONS (Sync + Refresh)
  private chatService = inject(ChatService);

  // 2. Inject Coordinator for STATE (Progress + Results)
  private syncService = inject(CloudSyncService);

  private snackBar = inject(MatSnackBar);

  // --- Local UI State ---
  syncContacts = signal(true);
  syncMessages = signal(true);

  // --- Delegated Service State (Read from Sync Service) ---
  isSyncing = this.syncService.isSyncing;
  lastResult = this.syncService.lastSyncResult;

  async triggerSync(): Promise<void> {
    const providerId = 'google';

    try {
      // AUTH CHECK: We still check permissions via the Sync Service
      // because ChatService doesn't expose auth methods.
      if (!this.syncService.hasPermission(providerId)) {
        const authorized = await this.syncService.connect(providerId, {
          syncContacts: this.syncContacts(),
          syncMessages: this.syncMessages(),
        });

        if (!authorized) return;
      }

      // ACTION: We call the ChatService Orchestrator
      // This ensures that when the sync finishes, the Inbox and Contacts
      // are immediately refreshed in the UI.
      await this.chatService.sync({
        providerId: 'google',
        syncContacts: this.syncContacts(),
        syncMessages: this.syncMessages(),
      });

      // The ChatService.sync() awaits the result internally, so we can check
      // the result signal immediately after.
      const result = this.lastResult();

      if (result?.success) {
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
