import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { AppState } from '@nx-platform-application/messenger-state-app';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';
import { MessengerSyncCardComponent } from '../messenger-sync-card/messenger-sync-card.component';

// ✅ NEW: Directory API
import { DirectoryManagementApi } from '@nx-platform-application/directory-api';

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
  // ✅ Inject Directory API
  private directory = inject(DirectoryManagementApi);

  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private logger = inject(Logger);

  async onClearHistory() {
    const ref = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Clear Local History?',
        message:
          'This will permanently delete ALL message history from this device. If you have not synced to the cloud, this data will be lost forever.',
        confirmText: 'Delete Everything',
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

  // ✅ NEW: Directory Wipe
  async onClearDirectory() {
    const ref = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Clear Network Directory?',
        message:
          'This flushes the cache of discovered network groups and users. It does not delete your account or messages.',
        confirmText: 'Flush Cache',
        warn: false, // Less dangerous than full wipe
      },
    });

    if (await firstValueFrom(ref.afterClosed())) {
      try {
        await this.directory.clear();
        this.snackBar.open('Directory cache flushed.', 'OK', {
          duration: 3000,
        });
      } catch (e) {
        this.logger.error('Failed to clear directory', e);
        this.snackBar.open('Error clearing directory.', 'Close');
      }
    }
  }

  async onSecureLogout() {
    const ref = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Secure Logout & Wipe?',
        message:
          'This will delete all local data, encryption keys, and directory caches. You will be logged out.',
        confirmText: 'Wipe & Logout',
        warn: true,
      },
    });

    if (await firstValueFrom(ref.afterClosed())) {
      await this.appState.fullDeviceWipe();
    }
  }
}
