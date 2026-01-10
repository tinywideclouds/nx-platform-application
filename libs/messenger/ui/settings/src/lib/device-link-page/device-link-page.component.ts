import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AppState } from '@nx-platform-application/messenger-state-app';
import { DevicePairingSession } from '@nx-platform-application/messenger-types';

// ✅ Import Shared UI
import { DeviceLinkQrDisplayComponent } from '../device-link-ui/device-link-qr-display/device-link-qr-display.component';
import { DeviceLinkScannerUiComponent } from '../device-link-ui/device-link-scanner-ui/device-link-scanner-ui.component';

@Component({
  selector: 'lib-device-link-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    DeviceLinkQrDisplayComponent,
    DeviceLinkScannerUiComponent,
  ],
  templateUrl: './device-link-page.component.html',
  styleUrl: './device-link-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceLinkPageComponent {
  private appState = inject(AppState);
  private snackBar = inject(MatSnackBar);

  // State
  isLinking = signal(false);
  isShowingCode = signal(false); // Toggle between Scan vs Show
  session = signal<DevicePairingSession | null>(null);

  // --- ACTIONS ---

  async handleScan(qrCode: string): Promise<void> {
    this.isLinking.set(true);
    try {
      await this.appState.linkTargetDevice(qrCode);
      this.snackBar.open('Device successfully linked!', 'Close', {
        duration: 5000,
      });
    } catch (error) {
      console.error('Linking failed', error);
      this.snackBar.open('Failed to link device. Invalid QR?', 'Retry', {
        duration: 5000,
      });
    } finally {
      this.isLinking.set(false);
    }
  }

  async enableShowMode(): Promise<void> {
    this.isShowingCode.set(true);
    try {
      const session = await this.appState.startSourceLinkSession();
      this.session.set(session);
    } catch (e) {
      this.snackBar.open('Could not generate secure code.', 'Close');
      this.isShowingCode.set(false);
    }
  }

  switchToScanMode(): void {
    this.isShowingCode.set(false);
    this.session.set(null);
  }
}
