# 📷 Platform UI QR Codes

**Layer:** UI
**Scope:** Platform (Shared)
**Package:** `@nx-platform-application/platform-ui-qr-codes`

## 🧠 Purpose

This library provides a robust, reactive wrapper around the [html5-qrcode](https://github.com/mebjas/html5-qrcode) library.
It abstracts the complex imperative setup of camera permissions and scanning loops into a simple Angular Component driven by Signals.

## 📦 Components

### `QrScannerComponent` (`<platform-qr-scanner>`)

A self-contained viewfinder that emits strings when a QR code is detected.

- **Inputs:**
  - `active`: `boolean` (Required). Controls the camera lifecycle.
    - `true`: Request camera permissions -> Start Video -> Scan.
    - `false`: Stop Video -> Release Camera -> Clear Canvas.
- **Outputs:**
  - `scanSuccess`: `EventEmitter<string>`. Emits the decoded text (e.g., `urn:user:123`).
  - `scanError`: `EventEmitter<string>`. Emits critical initialization errors.

## 💻 Usage Example

**In a Smart Component (e.g., Device Linking Page):**

```html
@if (isScanning()) {
<platform-qr-scanner [active]="true" (scanSuccess)="onCodeFound($event)" (scanError)="onCameraError($event)"></platform-qr-scanner>
}
```

```typescript
export class LinkDeviceComponent {
  isScanning = signal(false);
  logger = inject(Logger);

  onCodeFound(code: string) {
    this.logger.info('QR Code detected:', code);
    this.isScanning.set(false); // Auto-stop scanning
    this.processCode(code);
  }
}
```

## 🧪 Testing

The component is tested using a mock of the `html5-qrcode` library.

- **Tests:** Verify that the `active` signal correctly triggers `start()` and `stop()`/`clear()` on the underlying library.
- **Safety:** Ensures resources are cleaned up when the component is destroyed (e.g., navigating away).
