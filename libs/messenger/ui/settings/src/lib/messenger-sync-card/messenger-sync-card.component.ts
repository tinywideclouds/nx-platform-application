// libs/messenger/settings-ui/src/lib/messenger-sync-card/messenger-sync-card.component.ts

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';

import { CloudSyncService } from '@nx-platform-application/messenger-state-cloud-sync';

@Component({
  selector: 'lib-messenger-sync-card',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    MatButtonModule,
  ],
  templateUrl: './messenger-sync-card.component.html',
  styleUrl: './messenger-sync-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerSyncCardComponent {
  private cloudSync = inject(CloudSyncService);

  // --- STATE ---
  isSyncing = this.cloudSync.isSyncing;
  lastResult = this.cloudSync.lastSyncResult;

  // REACTIVITY FIX: Use the signal directly instead of a static method call
  isCloudEnabled = this.cloudSync.isConnected;

  // --- ACTIONS ---
  async toggleCloudSync(checked: boolean) {
    if (this.isSyncing()) return; // Prevent interaction during sync

    if (checked) {
      await this.onReconnect();
    } else {
      await this.cloudSync.revokePermission();
    }
  }

  async onReconnect() {
    // connect() returns boolean promise, but the signal will update automatically
    const success = await this.cloudSync.connect('google-drive');
    if (success) {
      this.cloudSync.syncNow({
        providerId: 'google-drive',
        syncContacts: true,
        syncMessages: true,
      });
    }
  }
}
