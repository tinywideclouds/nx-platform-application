import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QrScannerComponent } from './qr-scanner.component';
import { vi } from 'vitest';

// --- Mock html5-qrcode ---
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockClear = vi.fn();

vi.mock('html5-qrcode', () => {
  return {
    Html5Qrcode: vi.fn().mockImplementation(() => ({
      start: mockStart,
      stop: mockStop,
      clear: mockClear,
      isScanning: false,
    })),
    Html5QrcodeSupportedFormats: {
      QR_CODE: 0,
    },
  };
});

describe('QrScannerComponent', () => {
  let component: QrScannerComponent;
  let fixture: ComponentFixture<QrScannerComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [QrScannerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(QrScannerComponent);
    component = fixture.componentInstance;

    // Set default input
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should NOT start scanning initially if active is false', () => {
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('should start scanning when active becomes true', async () => {
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();

    // Effect runs asynchronously
    await vi.waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });
  });

  it('should stop scanning when active becomes false', async () => {
    // 1. Start
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    await vi.waitFor(() => expect(mockStart).toHaveBeenCalled());

    // 2. Stop
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();

    await vi.waitFor(() => {
      // We expect stop or clear to be called
      // Note: Our logic calls stop() then clear()
      expect(mockClear).toHaveBeenCalled();
    });
  });

  it('should cleanup on destroy', async () => {
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();

    // Trigger Angular's destroy lifecycle
    fixture.destroy();

    // Verify cleanup
    expect(mockClear).toHaveBeenCalled();
  });
});
