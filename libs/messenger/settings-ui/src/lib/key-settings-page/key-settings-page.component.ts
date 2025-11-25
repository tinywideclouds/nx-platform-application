// libs/messenger/settings-ui/src/lib/key-settings-page/key-settings-page.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';

import { ChatService } from '@nx-platform-application/chat-state';
import { Logger } from '@nx-platform-application/console-logger';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';

@Component({
  selector: 'lib-key-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './key-settings-page.component.html',
  styleUrl: './key-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeySettingsPageComponent implements OnInit {
  private chatService = inject(ChatService);
  private cryptoService = inject(MessengerCryptoService);
  private logger = inject(Logger);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  isLoading = false;
  fingerprint = signal<string>('Loading...');

  ngOnInit(): void {
    this.loadFingerprint();
  }

  async loadFingerprint(): Promise<void> {
    const myUrn = this.chatService.currentUserUrn();
    if (!myUrn) {
      this.fingerprint.set('Unknown (Not Logged In)');
      return;
    }

    try {
      const keys = await this.cryptoService.loadMyPublicKeys(myUrn);

      if (keys && keys.encKey) {
        // REFACTOR: Logic moved to service
        const fp = await this.cryptoService.getFingerprint(keys.encKey);
        this.fingerprint.set(fp);
      } else {
        this.fingerprint.set('No Local Keys Generated');
      }
    } catch (e) {
      this.logger.error('Failed to load fingerprint from local storage', e);
      this.fingerprint.set('Error loading key');
    }
  }

  async onResetKeys(): Promise<void> {
    const ref = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Reset Identity Keys?',
        message:
          'Your friends will see a "Safety Number Changed" warning. You will not be able to decrypt messages sent to your old keys.',
        confirmText: 'Reset Keys',
        warn: true,
      },
    });

    const confirmed = await firstValueFrom(ref.afterClosed());

    if (confirmed) {
      await this.executeReset();
    }
  }

  private async executeReset(): Promise<void> {
    this.isLoading = true;
    this.fingerprint.set('Regenerating...');
    try {
      await this.chatService.resetIdentityKeys();

      this.logger.info('User manually reset identity keys.');

      this.snackBar.open('Identity Keys regenerated successfully.', 'OK', {
        duration: 3000,
        panelClass: ['bg-green-600', 'text-white'],
      });

      await this.loadFingerprint();
    } catch (err) {
      this.logger.error('Failed to reset keys', err);

      this.snackBar.open('Failed to reset keys. Please try again.', 'Dismiss', {
        duration: 5000,
        panelClass: ['bg-red-600', 'text-white'],
      });
      this.fingerprint.set('Error');
    } finally {
      this.isLoading = false;
    }
  }
}
