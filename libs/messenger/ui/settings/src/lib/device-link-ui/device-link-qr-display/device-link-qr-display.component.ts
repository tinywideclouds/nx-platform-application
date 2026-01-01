import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QRCodeComponent } from 'angularx-qrcode';
import { DevicePairingSession } from '@nx-platform-application/messenger-types';

@Component({
  selector: 'lib-device-link-qr-display',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    QRCodeComponent,
  ],
  templateUrl: './device-link-qr-display.component.html',
  styleUrl: './device-link-qr-display.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceLinkQrDisplayComponent {
  session = input<DevicePairingSession | null>(null);
  showWarning = input(false);
  loadingText = input('Generating secure session...');
  switchButtonText = input("I can't scan this code. Use my camera instead.");

  switchToScan = output<void>();
}
