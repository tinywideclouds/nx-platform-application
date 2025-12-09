import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  viewChild,
  effect,
  output,
  OnDestroy,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

@Component({
  selector: 'lib-qr-scanner',
  standalone: true,
  imports: [CommonModule],
  template: ` <div #scannerContainer id="reader" class="scanner-box"></div> `,
  styleUrl: './qr-scanner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrScannerComponent implements OnDestroy {
  // Inputs
  active = input.required<boolean>();

  // Outputs
  scanSuccess = output<string>();
  scanError = output<string>();

  // View Child
  scannerContainer = viewChild.required<ElementRef>('scannerContainer');

  private html5Qrcode: Html5Qrcode | null = null;

  constructor() {
    // Reactively start/stop scanner based on 'active' signal
    effect(() => {
      const isActive = this.active();
      if (isActive) {
        this.startScanning();
      } else {
        this.stopScanning();
      }
    });
  }

  private async startScanning(): Promise<void> {
    if (this.html5Qrcode) {
      return; // Already running
    }

    const elementId = this.scannerContainer().nativeElement.id;

    try {
      this.html5Qrcode = new Html5Qrcode(elementId);

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      };

      await this.html5Qrcode.start(
        { facingMode: 'environment' }, // Prefer back camera
        config,
        (decodedText) => {
          this.scanSuccess.emit(decodedText);
          // Optional: Stop automatically on success?
          // For now, we let the parent decide to toggle 'active' to false.
        },
        (errorMessage) => {
          // Ignored for noise, or emit if critical
          // this.scanError.emit(errorMessage);
        }
      );
    } catch (err) {
      this.scanError.emit('Failed to start camera: ' + err);
      this.stopScanning();
    }
  }

  private async stopScanning(): Promise<void> {
    if (this.html5Qrcode) {
      try {
        if (this.html5Qrcode.isScanning) {
          await this.html5Qrcode.stop();
        }
        this.html5Qrcode.clear();
      } catch (e) {
        console.warn('Error stopping scanner', e);
      } finally {
        this.html5Qrcode = null;
      }
    }
  }

  ngOnDestroy(): void {
    // Cleanup ensures camera light goes off if component is destroyed
    this.stopScanning();
  }
}
