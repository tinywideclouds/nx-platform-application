import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { DevicePairingSession } from '@nx-platform-application/messenger-types';
import { ChatService } from '@nx-platform-application/messenger-state-chat-session';

// ✅ Import Shared UI
import {
  DeviceLinkQrDisplayComponent,
  DeviceLinkScannerUiComponent,
} from '@nx-platform-application/messenger-settings-ui';
import { Logger } from '@nx-platform-application/console-logger';

export type WizardStep = 'CHOICE' | 'LINKING' | 'RESET_WARNING';
export type LinkMode = 'SHOW' | 'SCAN' | 'REVIEW';

@Component({
  selector: 'messenger-device-link-wizard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    DeviceLinkQrDisplayComponent,
    DeviceLinkScannerUiComponent,
  ],
  templateUrl: './device-link-wizard.component.html',
  styleUrl: './device-link-wizard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceLinkWizardComponent implements OnInit {
  private chatService = inject(ChatService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private logger = inject(Logger);
  private destroyRef = inject(DestroyRef);

  // State
  step = signal<WizardStep>('CHOICE');
  mode = signal<LinkMode>('SHOW');
  session = signal<DevicePairingSession | null>(null);

  // Debug/Review State
  scannedRaw = signal<string | null>(null);
  scannedData = computed(() => {
    const raw = this.scannedRaw();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return { error: 'Invalid JSON', raw };
    }
  });

  private pollInterval: any;

  constructor() {
    // Register cleanup
    this.destroyRef.onDestroy(() => {
      this.stopPolling();
    });
  }

  ngOnInit() {
    /* Implicit */
  }

  // --- Dynamic Content Helpers ---
  getIcon(): string {
    if (this.mode() === 'REVIEW') return 'plagiarism';
    if (this.mode() === 'SCAN') return 'camera_alt';
    switch (this.step()) {
      case 'CHOICE':
        return 'lock_person';
      case 'LINKING':
        return 'qr_code_2';
      case 'RESET_WARNING':
        return 'warning';
      default:
        return 'help';
    }
  }

  getTitle(): string {
    if (this.mode() === 'REVIEW') return 'Review Code';
    if (this.mode() === 'SCAN') return 'Scan Code';
    switch (this.step()) {
      case 'CHOICE':
        return 'Identity Conflict';
      case 'LINKING':
        return 'Link Device';
      case 'RESET_WARNING':
        return 'Reset Identity?';
      default:
        return '';
    }
  }

  getSubtitle(): string {
    if (this.mode() === 'REVIEW') return 'Verify contents before connecting.';
    if (this.mode() === 'SCAN') return 'Scan code on existing device';
    switch (this.step()) {
      case 'CHOICE':
        return 'Resolve encryption key mismatch';
      case 'LINKING':
        return 'Scan with other device';
      case 'RESET_WARNING':
        return 'Action cannot be undone';
      default:
        return '';
    }
  }

  // --- Actions ---

  async startLinking() {
    this.step.set('LINKING');
    this.mode.set('SHOW');
    try {
      const session = await this.chatService.startTargetLinkSession();
      this.logger.info('Started linking session', session);
      this.session.set(session);
      if (session.privateKey) this.startPolling(session.privateKey);
    } catch (e) {
      this.step.set('CHOICE');
    }
  }

  // ✅ Switching Modes
  switchToScan() {
    this.stopPolling();
    this.session.set(null);
    this.scannedRaw.set(null);
    this.mode.set('SCAN');
  }

  switchToShow() {
    this.stopPolling();
    this.mode.set('SHOW');
    this.startLinking(); // Restart generation
  }

  // ✅ Scan Result -> Review
  onScanResult(qrCode: string) {
    this.scannedRaw.set(qrCode);
    this.mode.set('REVIEW');
  }

  async confirmConnection() {
    const code = this.scannedRaw();
    if (!code) return;
    try {
      this.snackBar.open('Retrieving keys...', '', { duration: 2000 });
      await this.chatService.redeemSourceSession(code);
      this.snackBar.open('Success! Device linked.', 'Close', {
        duration: 3000,
      });
    } catch (e) {
      this.logger.error('Linking failed', e);
      this.snackBar.open('Failed to link.', 'Retry', { duration: 5000 });
    }
  }

  async confirmReset() {
    await this.chatService.performIdentityReset();
  }

  async onLogout() {
    try {
      // ✅ FIX: Ensure we wait for the logout observable/promise to complete
      await this.chatService.sessionLogout();
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      this.router.navigate(['/login']);
    }
  }

  // --- Polling ---
  private startPolling(sessionPrivKey: CryptoKey) {
    this.stopPolling();
    this.pollInterval = setInterval(async () => {
      try {
        const found =
          await this.chatService.checkForSyncMessage(sessionPrivKey);
        if (found) this.stopPolling();
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
