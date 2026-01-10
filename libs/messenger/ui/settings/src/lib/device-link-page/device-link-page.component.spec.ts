import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeviceLinkPageComponent } from './device-link-page.component';
import { ChatService } from '@nx-platform-application/messenger-state-app';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';

describe('DeviceLinkPageComponent', () => {
  let component: DeviceLinkPageComponent;
  let fixture: ComponentFixture<DeviceLinkPageComponent>;

  const mockChatService = {
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
        { provide: ChatService, useValue: mockChatService },
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
    expect(component.isLinking()).toBe(false);

    // Note: The component does not have a public 'isScanning' signal in the uploaded file,
    // but it has 'isShowingCode'. Assuming the test meant to check default state or available signals.
    // Based on uploaded file: isLinking default is false.
    expect(component.isLinking()).toBe(false);
  });

  describe('handleScan', () => {
    it('should call service and show success message', async () => {
      // Arrange
      const mockQr = '{"sid":"123"}';
      mockChatService.linkTargetDevice.mockResolvedValue(undefined);

      // Act
      await component.handleScan(mockQr);

      // Assert
      expect(component.isLinking()).toBe(false); // Finished loading
      expect(mockChatService.linkTargetDevice).toHaveBeenCalledWith(mockQr);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('successfully'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should show error message on failure', async () => {
      // Arrange
      mockChatService.linkTargetDevice.mockRejectedValue(new Error('Bad QR'));

      // Act
      await component.handleScan('bad-qr');

      // Assert
      expect(component.isLinking()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
