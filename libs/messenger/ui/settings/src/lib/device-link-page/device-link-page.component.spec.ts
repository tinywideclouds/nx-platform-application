import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeviceLinkPageComponent } from './device-link-page.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ✅ NEW: Import Facade
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { DevicePairingSession } from '@nx-platform-application/messenger-types';

describe('DeviceLinkPageComponent', () => {
  let component: DeviceLinkPageComponent;
  let fixture: ComponentFixture<DeviceLinkPageComponent>;
  let facade: ChatIdentityFacade; // Typed variable for the mock

  // Mock Data
  const mockSession: DevicePairingSession = {
    sessionId: 'sess-123',
    qrPayload: 'mock-qr-data',
    publicKey: { algorithm: { name: 'ECDH' } } as any,
    privateKey: { algorithm: { name: 'ECDH' } } as any,
    mode: 'SENDER_HOSTED',
  };

  const mockFacade = {
    linkTargetDevice: vi.fn(),
    startSourceLinkSession: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [DeviceLinkPageComponent],
      providers: [
        // ✅ Swap Legacy Service for Facade Mock
        { provide: ChatIdentityFacade, useValue: mockFacade },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceLinkPageComponent);
    component = fixture.componentInstance;
    facade = TestBed.inject(ChatIdentityFacade);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Scanning Mode (Linking a new device)', () => {
    it('should call facade.linkTargetDevice on successful scan', async () => {
      // Arrange
      const qrCode = '{"sid":"123"}';
      mockFacade.linkTargetDevice.mockResolvedValue(undefined);

      // Act
      await component.handleScan(qrCode);

      // Assert
      expect(component.isLinking()).toBe(false); // Should unlock UI
      expect(facade.linkTargetDevice).toHaveBeenCalledWith(qrCode);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('successfully'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should handle linking errors gracefully', async () => {
      // Arrange
      mockFacade.linkTargetDevice.mockRejectedValue(new Error('Invalid QR'));

      // Act
      await component.handleScan('bad-qr');

      // Assert
      expect(component.isLinking()).toBe(false); // Should unlock UI
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('Display Mode (Showing code to be scanned)', () => {
    it('should start a source session when enabling show mode', async () => {
      // Arrange
      mockFacade.startSourceLinkSession.mockResolvedValue(mockSession);

      // Act
      await component.enableShowMode();

      // Assert
      expect(facade.startSourceLinkSession).toHaveBeenCalled();
      expect(component.isShowingCode()).toBe(true);
      expect(component.session()).toEqual(mockSession);
    });

    it('should revert state if session generation fails', async () => {
      // Arrange
      mockFacade.startSourceLinkSession.mockRejectedValue(new Error('Network'));

      // Act
      await component.enableShowMode();

      // Assert
      expect(component.isShowingCode()).toBe(false);
      expect(component.session()).toBeNull();
      expect(mockSnackBar.open).toHaveBeenCalled();
    });

    it('should clear session when switching back to scan mode', () => {
      // Set initial state
      component.session.set(mockSession);
      component.isShowingCode.set(true);

      // Act
      component.switchToScanMode();

      // Assert
      expect(component.isShowingCode()).toBe(false);
      expect(component.session()).toBeNull();
    });
  });
});
