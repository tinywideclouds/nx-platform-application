// libs/messenger/settings-ui/src/lib/identity-settings-page/identity-settings-page.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { ChatService } from '@nx-platform-application/chat-state';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access'; // Import Cloud Service
import { SecureLogoutDialogComponent } from '../secure-logout-dialog/secure-logout-dialog.component';

@Component({
  selector: 'lib-identity-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressBarModule,
  ],
  templateUrl: './identity-settings-page.component.html',
  styleUrl: './identity-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentitySettingsPageComponent {
  private authService = inject(IAuthService);
  private chatService = inject(ChatService);
  private cloudService = inject(ChatCloudService); // Inject Cloud
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  currentUser = this.authService.currentUser;

  // Cloud Signals
  isCloudEnabled = this.cloudService.isCloudEnabled;
  isBackingUp = this.cloudService.isBackingUp;
  lastBackup = this.cloudService.lastBackupTime;

  initials = computed(() => {
    const user = this.currentUser();
    if (!user || !user.alias) return '?';
    return user.alias.slice(0, 2).toUpperCase();
  });

  constructor() {
    // Optional: Reactive check for backup failures could go here
    // e.g. effect(() => if (error) showSnackBar...)
  }

  async onToggleCloud(): Promise<void> {
    if (this.isCloudEnabled()) {
      // Disconnect Logic
      await this.cloudService.disconnect();
      this.snackBar.open('Cloud backup disabled.', undefined, {
        duration: 2000,
      });
    } else {
      // Connect Logic (The Google Popup)
      const success = await this.cloudService.connect('google');
      if (success) {
        this.snackBar.open('Connected to Google Drive', undefined, {
          duration: 3000,
        });
        // Optional: Trigger immediate backup
        this.cloudService.backup('google');
      } else {
        this.snackBar
          .open('Connection cancelled', 'Retry', { duration: 3000 })
          .onAction()
          .subscribe(() => this.onToggleCloud());
      }
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
