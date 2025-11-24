// libs/messenger/settings-ui/src/lib/key-settings-page/key-settings-page.component.ts

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { ChatService } from '@nx-platform-application/chat-state';
import { Logger } from '@nx-platform-application/console-logger';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';

@Component({
  selector: 'lib-key-settings-page',
  standalone: true,
  imports: [
    CommonModule, 
    MatButtonModule, 
    MatCardModule, 
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  templateUrl: './key-settings-page.component.html',
  styleUrl: './key-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeySettingsPageComponent {
  private chatService = inject(ChatService);
  private logger = inject(Logger);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  isLoading = false;

  async onResetKeys(): Promise<void> {
    const ref = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Reset Identity Keys?',
        message: 'Your friends will see a "Safety Number Changed" warning. You will not be able to decrypt messages sent to your old keys.',
        confirmText: 'Reset Keys',
        warn: true
      }
    });

    // 1. Convert Observable to Promise to allow linear await in tests
    const confirmed = await firstValueFrom(ref.afterClosed());

    if (confirmed) {
      await this.executeReset();
    }
  }

  private async executeReset(): Promise<void> {
    this.isLoading = true;
    try {
      await this.chatService.resetIdentityKeys();
      
      this.logger.info('User manually reset identity keys.');
      
      this.snackBar.open('Identity Keys regenerated successfully.', 'OK', {
        duration: 3000,
        panelClass: ['bg-green-600', 'text-white']
      });

    } catch (err) {
      this.logger.error('Failed to reset keys', err);
      
      this.snackBar.open('Failed to reset keys. Please try again.', 'Dismiss', {
        duration: 5000,
        panelClass: ['bg-red-600', 'text-white']
      });
    } finally {
      this.isLoading = false;
    }
  }
}