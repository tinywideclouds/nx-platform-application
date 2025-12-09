import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Domain Imports
import { ChatService } from '@nx-platform-application/chat-state';
import { QrScannerComponent } from '@nx-platform-application/platform-ui-toolkit';

@Component({
  selector: 'lib-device-link-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    QrScannerComponent,
  ],
  templateUrl: './device-link-page.component.html',
  styleUrl: './device-link-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceLinkPageComponent {
  private chatService = inject(ChatService);
  private snackBar = inject(MatSnackBar);

  // UI State
  isScanning = signal(false);
  isLinking = signal(false);

  async handleScan(qrCode: string): Promise<void> {
    // 1. Stop Scanning immediately
    this.isScanning.set(false);
    this.isLinking.set(true);

    try {
      // 2. Perform the Handshake
      await this.chatService.linkTargetDevice(qrCode);

      this.snackBar.open('Device successfully linked!', 'Close', {
        duration: 5000,
        panelClass: 'success-snackbar',
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

  handleScanError(error: string): void {
    // Non-critical camera errors (e.g., glare) just log
    // We only show snackbar if it's persistent or fatal
    console.warn('Scanner error:', error);
  }
}
