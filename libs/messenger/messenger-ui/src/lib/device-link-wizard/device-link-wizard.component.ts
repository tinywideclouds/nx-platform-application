import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { QRCodeComponent } from 'angularx-qrcode';

import { ChatService, LinkSession } from '@nx-platform-application/chat-state';
// We need to import the scanner if we want to use it here.
// Assuming QrScannerComponent is exported from settings-ui or we moved it to a shared place.
// For this example, I'll assume we can import it from where we defined it.
import { QrScannerComponent } from '@nx-platform-application/platform-ui-toolkit';

export type WizardStep = 'CHOICE' | 'LINKING' | 'RESET_WARNING';
export type LinkMode = 'SHOW' | 'SCAN'; // Show QR (Receiver) vs Scan QR (Sender)

@Component({
  selector: 'messenger-device-link-wizard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatDialogModule,
    MatSnackBarModule,
    QRCodeComponent,
    QrScannerComponent, // Imported Scanner
  ],
  templateUrl: './device-link-wizard.component.html',
  styleUrl: './device-link-wizard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceLinkWizardComponent implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private snackBar = inject(MatSnackBar);

  // State
  step = signal<WizardStep>('CHOICE');
  mode = signal<LinkMode>('SHOW'); // Default to showing QR
  session = signal<LinkSession | null>(null);

  private pollInterval: any;

  ngOnInit() {
    // Implicit init logic
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  // --- Dynamic Content Helpers ---
  getIcon(): string {
    if (this.step() === 'LINKING' && this.mode() === 'SCAN')
      return 'camera_alt';
    switch (this.step()) {
      case 'CHOICE':
        return 'lock_person';
      case 'LINKING':
        return 'qr_code_2';
      case 'RESET_WARNING':
        return 'warning';
    }
  }

  getTitle(): string {
    if (this.step() === 'LINKING' && this.mode() === 'SCAN') return 'Scan Code';
    switch (this.step()) {
      case 'CHOICE':
        return 'Identity Conflict';
      case 'LINKING':
        return 'Link Device';
      case 'RESET_WARNING':
        return 'Reset Identity?';
    }
  }

  getSubtitle(): string {
    if (this.step() === 'LINKING' && this.mode() === 'SCAN')
      return 'Scan the code on your existing device';
    switch (this.step()) {
      case 'CHOICE':
        return 'Resolve encryption key mismatch';
      case 'LINKING':
        return 'Scan this code with your other device';
      case 'RESET_WARNING':
        return 'This action cannot be undone';
    }
  }

  // --- Actions ---

  async startLinking() {
    this.step.set('LINKING');
    this.mode.set('SHOW'); // Default to Receiver-Hosted
    try {
      const session = await this.chatService.startTargetLinkSession();
      this.session.set(session);
      // Mode A: We have a private key, so we poll
      if (session.privateKey) {
        this.startPolling(session.privateKey);
      }
    } catch (e) {
      console.error('Failed to start linking session', e);
      this.step.set('CHOICE');
    }
  }

  switchMode(newMode: LinkMode) {
    this.stopPolling();
    this.mode.set(newMode);
    if (newMode === 'SHOW') {
      this.startLinking(); // Restart Receiver flow
    } else {
      // Clean up session if switching to scan
      this.session.set(null);
    }
  }

  async handleScan(qrCode: string) {
    try {
      this.mode.set('SHOW'); // Switch back to show spinner/progress if needed, or stay in scan with loading overlay
      // Actually, let's just show a snackbar and wait
      this.snackBar.open('Code scanned. Attempting to retrieve keys...', '', {
        duration: 3000,
      });

      await this.chatService.redeemSourceSession(qrCode);

      this.snackBar.open('Success! Device linked.', 'Close', {
        duration: 3000,
      });
      // State transition happens automatically in ChatService
    } catch (e) {
      console.error('Failed to redeem session', e);
      this.snackBar.open('Failed to link. Invalid code or timeout.', 'Retry', {
        duration: 5000,
      });
      this.mode.set('SCAN'); // Let them try again
    }
  }

  async confirmReset() {
    await this.chatService.performIdentityReset();
  }

  // --- Polling Logic ---

  private startPolling(sessionPrivKey: CryptoKey) {
    this.stopPolling();
    this.pollInterval = setInterval(async () => {
      try {
        const found = await this.chatService.checkForSyncMessage(
          sessionPrivKey
        );
        if (found) {
          this.stopPolling();
        }
      } catch (e) {
        console.error('Polling error', e);
      }
    }, 2000);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
