import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ChatService } from '@nx-platform-application/chat-state';
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

  // Metrics for the UI (Context for clearing)
  messageCount = this.chatService.messages;

  onClearMessageHistory(): void {
    if (
      confirm(
        'Are you sure you want to delete all message history on this device?'
      )
    ) {
      this.logger.warn('Clear History requested.');
      this.snackBar.open('History cleared (Simulation).', 'OK', {
        duration: 3000,
      });
    }
  }

  onClearContacts(): void {
    if (
      confirm('Are you sure you want to delete all contacts on this device?')
    ) {
      this.logger.warn('Clear History requested.');
      this.snackBar.open('History cleared (Simulation).', 'OK', {
        duration: 3000,
      });
    }
  }

  onSecureLogout(): void {
    this.dialog
      .open(SecureLogoutDialogComponent)
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) this.chatService.logout();
      });
  }
}
