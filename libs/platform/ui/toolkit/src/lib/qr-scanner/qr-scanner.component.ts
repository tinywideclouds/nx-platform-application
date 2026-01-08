import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  viewChild,
  effect,
  output,
  input,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Logger } from '@nx-platform-application/console-logger';

@Component({
  selector: 'lib-qr-scanner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-scanner.component.html',
  styleUrl: './qr-scanner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrScannerComponent {
  // Inputs
  active = input.required<boolean>();
  logger = inject(Logger);
  private destroyRef = inject(DestroyRef);

  // Outputs
  scanSuccess = output<string>();
  scanError = output<string>();

  // View Child
  scannerContainer = viewChild.required<ElementRef>('scannerContainer');

  private html5Qrcode: Html5Qrcode | null = null;

  statusMessage = 'Initializing...';

  constructor() {
    // Register cleanup logic
    this.destroyRef.onDestroy(() => {
      this.stopScanning();
    });

    // Reactively start/stop scanner based on 'active' signal
    effect(() => {
      const isActive = this.active();
      this.logger.debug(`QR Scanner active state changed: ${isActive}`);

      if (isActive) {
        this.startScanning();
      } else {
        this.stopScanning();
      }
    });
  }

  private async startScanning(): Promise<void> {
    if (this.html5Qrcode) {
      this.logger.debug('QR Scanner already running');
      return; // Already running
    }

    const element = this.scannerContainer().nativeElement;
    // Ensure the element has an ID, html5-qrcode requires it
    if (!element.id) element.id = 'reader-generated-' + Math.random();

    this.logger.info(`[QrScanner] Starting scanner on element: ${element.id}`);
    this.statusMessage = 'Requesting Camera...';

    try {
      this.html5Qrcode = new Html5Qrcode(element.id);

      const config = {
        fps: 10,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      await this.html5Qrcode.start(
        { facingMode: 'environment' }, // Prefer back camera
        config,
        (decodedText, decodedResult) => {
          // --- SUCCESS CALLBACK ---
          this.logger.info(
            '[QrScanner] SCAN SUCCESS:',
            decodedText,
            decodedResult,
          );
          this.statusMessage = 'Code Found!';
          this.scanSuccess.emit(decodedText);
          this.stopScanning();
        },
        (errorMessage) => {
          // Ignored for noise, or emit if critical
          // this.scanError.emit(errorMessage);
        },
      );

      this.logger.info('[QrScanner] Camera started successfully.');
      this.statusMessage = 'Scanning...';
    } catch (err) {
      this.logger.error('[QrScanner] Failed to start camera', err);
      this.statusMessage = 'Failed to start camera.';
      this.scanError.emit('Failed to start camera: ' + err);
      this.stopScanning();
    }
  }

  private async stopScanning(): Promise<void> {
    if (this.html5Qrcode) {
      this.logger.info('[QrScanner] Stopping scanner...');
      try {
        if (this.html5Qrcode.isScanning) {
          await this.html5Qrcode.stop();
        }
        this.html5Qrcode.clear();
        this.logger.info('[QrScanner] Scanner stopped.');
      } catch (e) {
        this.logger.warn('Error stopping scanner', e);
      } finally {
        this.html5Qrcode = null;
      }
    }
  }
}
