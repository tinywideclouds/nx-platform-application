import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ChatService } from '@nx-platform-application/messenger-state-chat-session';
import { Logger } from '@nx-platform-application/console-logger';
import { SecureLogoutDialogComponent } from '../secure-logout-dialog/secure-logout-dialog.component';
import { MessengerSyncCardComponent } from '../messenger-sync-card/messenger-sync-card.component';

@Component({
  selector: 'lib-data-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MessengerSyncCardComponent,
  ],
  templateUrl: './data-settings-page.component.html',
  styleUrl: './data-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSettingsPageComponent {
  private chatService = inject(ChatService);
  private dialog = inject(MatDialog);
  private logger = inject(Logger);
  private snackBar = inject(MatSnackBar);

  messageCount = this.chatService.messages;

  async onClearMessageHistory(): Promise<void> {
    const confirmed = confirm(
      'Are you sure? This will permanently delete all message history from this device. If you have not synced to the cloud, this data will be lost forever.',
    );

    if (confirmed) {
      try {
        this.logger.warn('[DataSettings] User initiated local message wipe');
        await this.chatService.clearLocalMessages();
        this.snackBar.open('Local message history cleared.', 'OK', {
          duration: 3000,
        });
      } catch (error) {
        this.logger.error('[DataSettings] Failed to clear messages', error);
        this.snackBar.open('Error clearing message history.', 'Close');
      }
    }
  }

  async onClearContacts(): Promise<void> {
    const confirmed = confirm(
      'Are you sure? This will delete all local contacts. Blocked users and sync history will be preserved.',
    );

    if (confirmed) {
      try {
        this.logger.warn('[DataSettings] User initiated local contacts wipe');
        await this.chatService.clearLocalContacts();
        this.snackBar.open('Local contacts cleared.', 'OK', { duration: 3000 });
      } catch (error) {
        this.logger.error('[DataSettings] Failed to clear contacts', error);
        this.snackBar.open('Error clearing contacts.', 'Close');
      }
    }
  }

  onSecureLogout(): void {
    this.dialog
      .open(SecureLogoutDialogComponent)
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.logger.info('[DataSettings] Performing secure wipe and logout');
          this.chatService.logout();
        }
      });
  }
}
