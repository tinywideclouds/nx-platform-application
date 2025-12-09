import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeviceLinkPageComponent } from './device-link-page.component';
import { DeviceLinkService } from '@nx-platform-application/chat-state';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';

describe('DeviceLinkPageComponent', () => {
  let component: DeviceLinkPageComponent;
  let fixture: ComponentFixture<DeviceLinkPageComponent>;

  const mockLinkService = {
    linkTargetDevice: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [DeviceLinkPageComponent],
      providers: [
        { provide: DeviceLinkService, useValue: mockLinkService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceLinkPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle scanning state', () => {
    // Initial
    expect(component.isScanning()).toBe(false);

    // Start
    component.isScanning.set(true);
    fixture.detectChanges();
    expect(component.isScanning()).toBe(true);
  });

  describe('handleScan', () => {
    it('should call service and show success message', async () => {
      // Arrange
      const mockQr = '{"sid":"123"}';
      mockLinkService.linkTargetDevice.mockResolvedValue(undefined);

      // Act
      await component.handleScan(mockQr);

      // Assert
      expect(component.isScanning()).toBe(false); // Stopped
      expect(component.isLinking()).toBe(false); // Finished loading
      expect(mockLinkService.linkTargetDevice).toHaveBeenCalledWith(mockQr);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('successfully'),
        expect.anything(),
        expect.anything()
      );
    });

    it('should show error message on failure', async () => {
      // Arrange
      mockLinkService.linkTargetDevice.mockRejectedValue(new Error('Bad QR'));

      // Act
      await component.handleScan('bad-qr');

      // Assert
      expect(component.isScanning()).toBe(false);
      expect(component.isLinking()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
        expect.anything(),
        expect.anything()
      );
    });
  });
});
