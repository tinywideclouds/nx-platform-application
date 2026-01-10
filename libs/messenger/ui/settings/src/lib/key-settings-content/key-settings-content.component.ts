import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AppState } from '@nx-platform-application/messenger-state-app';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';
import { Logger } from '@nx-platform-application/console-logger';
import { NotificationPermissionButtonComponent } from '../notification-permission-button/notification-permission-button';

@Component({
  selector: 'lib-key-settings-content',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDialogModule,
    MatSnackBarModule,
    NotificationPermissionButtonComponent,
  ],
  templateUrl: './key-settings-content.component.html',
  styleUrl: './key-settings-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeySettingsContentComponent {
  // Controlled by Parent (Page vs Sticky Wizard)
  isWizard = input(false);

  private appState = inject(AppState);
  private keyCache = inject(KeyCacheService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private logger = inject(Logger);

  // Mock for active sessions (In real app, comes from DeviceService)
  activeDevices = signal(1);

  onLinkDevice(): void {
    this.router.navigate(['/messenger', 'settings', 'link-device']);
  }

  async onClearKeyCache(): Promise<void> {
    try {
      await this.keyCache.clear();
      this.snackBar.open('Public Key Cache cleared.', 'OK', { duration: 3000 });
    } catch (e) {
      this.logger.error('Failed to clear key cache', e);
      this.snackBar.open('Error clearing cache.', 'Close');
    }
  }

  async onResetIdentity(): Promise<void> {
    const ref = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Regenerate Identity Keys?',
        message:
          'This will invalidate your current session on other devices. You will need to re-verify safety numbers.',
        confirmText: 'Regenerate',
        warn: true,
      },
    });

    if (await firstValueFrom(ref.afterClosed())) {
      try {
        await this.appState.resetIdentityKeys();
        this.snackBar.open('Identity keys regenerated.', 'OK', {
          duration: 3000,
        });
      } catch (error) {
        this.logger.error('Failed to reset identity', error);
        this.snackBar.open('Error generating keys.', 'Close');
      }
    }
  }
}
