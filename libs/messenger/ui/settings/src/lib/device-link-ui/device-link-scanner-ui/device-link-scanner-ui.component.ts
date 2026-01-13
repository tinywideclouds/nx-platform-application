import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { QrScannerComponent } from '@nx-platform-application/platform-ui-qr-codes';

@Component({
  selector: 'lib-device-link-scanner-ui',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, QrScannerComponent],
  templateUrl: './device-link-scanner-ui.component.html',
  styleUrl: './device-link-scanner-ui.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceLinkScannerUiComponent {
  // We use a writable model signal for 'active' to let this component manage the toggle
  // but communicate changes back up if needed.
  active = signal(false);

  switchButtonText = input('Show code instead');

  scanSuccess = output<string>();
  scanError = output<string>();
  switchToDisplay = output<void>();
}
