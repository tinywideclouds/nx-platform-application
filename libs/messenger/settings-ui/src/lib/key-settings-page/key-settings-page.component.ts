import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ChatService } from '@nx-platform-application/chat-state';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';
import { Logger } from '@nx-platform-application/console-logger';

import { NotificationPermissionButtonComponent } from '../notification-permission-button/notification-permission-button';

@Component({
  selector: 'lib-keys-routing-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDialogModule,
    MatSnackBarModule,
    NotificationPermissionButtonComponent,
  ],
  templateUrl: './key-settings-page.component.html',
  styleUrl: './key-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeySettingsPageComponent {
  private chatService = inject(ChatService);
  private keyCache = inject(KeyCacheService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private logger = inject(Logger);

  // --- ACTIONS ---

  onLinkDevice(): void {
    // Navigate to the Source UI (Scanner)
    this.router.navigate(['/messenger', 'settings', 'link-device']);
  }

  async onClearKeyCache(): Promise<void> {
    try {
      await this.keyCache.clear();
      this.snackBar.open('Public Key Cache cleared.', 'OK', { duration: 3000 });
    } catch (e) {
      this.logger.error('Failed to clear key cache', e);
    }
  }

  async onResetIdentity(): Promise<void> {
    const ref = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Regenerate Identity Keys?',
        message:
          'This will invalidate your current session on other devices. Your contacts will see a "Safety Number Changed" warning.',
        confirmText: 'Regenerate',
        warn: true,
      },
    });

    if (await firstValueFrom(ref.afterClosed())) {
      try {
        await this.chatService.performIdentityReset();
        this.snackBar.open('Identity Regenerated.', 'OK', { duration: 3000 });
      } catch (e) {
        this.snackBar.open('Failed to reset identity.', 'Dismiss');
      }
    }
  }
}
