import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { AppState } from '@nx-platform-application/messenger-state-app';
import { Logger } from '@nx-platform-application/console-logger';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';
import { MessengerSyncCardComponent } from '../messenger-sync-card/messenger-sync-card.component';

@Component({
  selector: 'lib-data-settings-content',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDialogModule,
    MatSnackBarModule,
    MessengerSyncCardComponent,
  ],
  templateUrl: './data-settings-content.component.html',
  styleUrl: './data-settings-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSettingsContentComponent {
  isWizard = input(false);

  private appState = inject(AppState);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private logger = inject(Logger);

  // Real connection to ChatService signals
  messageCount = computed(() => this.appState.messages().length);

  async onClearHistory() {
    const ref = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Clear Local History?',
        message:
          'This will delete all messages on this device. They will be lost unless synced to the cloud.',
        confirmText: 'Delete Messages',
        warn: true,
      },
    });

    if (await firstValueFrom(ref.afterClosed())) {
      try {
        await this.appState.clearLocalMessages();
        this.snackBar.open('Local message history cleared.', 'OK', {
          duration: 3000,
        });
      } catch (e) {
        this.logger.error('Failed to clear messages', e);
      }
    }
  }

  async onClearContacts() {
    const ref = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Clear Local Contacts?',
        message:
          'This removes contacts from this device. They remain in the cloud if synced.',
        confirmText: 'Delete Contacts',
        warn: true,
      },
    });

    if (await firstValueFrom(ref.afterClosed())) {
      try {
        await this.appState.clearLocalContacts();
        this.snackBar.open('Local contacts cleared.', 'OK', { duration: 3000 });
      } catch (e) {
        this.logger.error('Failed to clear contacts', e);
      }
    }
  }

  async onSecureLogout() {
    const ref = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Secure Logout & Wipe?',
        message:
          'This will delete all local data and encryption keys. You will be logged out.',
        confirmText: 'Wipe & Logout',
        warn: true,
      },
    });

    if (await firstValueFrom(ref.afterClosed())) {
      await this.appState.fullDeviceWipe();
    }
  }
}
