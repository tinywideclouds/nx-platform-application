import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KeySettingsPageComponent } from './key-settings-page.component';
import { ChatService } from '@nx-platform-application/chat-state';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { Logger } from '@nx-platform-application/console-logger';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';

describe('KeySettingsPageComponent', () => {
  let component: KeySettingsPageComponent;
  let fixture: ComponentFixture<KeySettingsPageComponent>;

  const mockUserUrn = URN.parse('urn:sm:user:test');

  const mockChatService = {
    resetIdentityKeys: vi.fn().mockResolvedValue(undefined),
    currentUserUrn: vi.fn().mockReturnValue(mockUserUrn),
  };
  const mockCryptoService = {
    loadMyPublicKeys: vi.fn(),
    getFingerprint: vi.fn(), // <--- NEW MOCK
  };
  const mockLogger = { info: vi.fn(), error: vi.fn() };
  const mockSnackBar = { open: vi.fn() };

  const mockDialogRef = { afterClosed: () => of(true) };
  const mockDialog = {
    open: vi.fn().mockReturnValue(mockDialogRef),
  };

  beforeEach(async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [KeySettingsPageComponent, NoopAnimationsModule],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: Logger, useValue: mockLogger },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: MatDialog, useValue: mockDialog },
      ],
    })
      .overrideProvider(MatDialog, { useValue: mockDialog })
      .overrideProvider(MatSnackBar, { useValue: mockSnackBar })
      .compileComponents();

    fixture = TestBed.createComponent(KeySettingsPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load and display fingerprint on init', async () => {
    // Mock returning valid keys
    const mockKeys = {
      encKey: new Uint8Array([1]),
      sigKey: new Uint8Array([2]),
    };
    mockCryptoService.loadMyPublicKeys.mockResolvedValue(mockKeys);
    // Mock the fingerprint derivation
    mockCryptoService.getFingerprint.mockResolvedValue('TEST-FINGERPRINT-123');

    // Trigger init
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockCryptoService.loadMyPublicKeys).toHaveBeenCalledWith(
      mockUserUrn
    );
    expect(mockCryptoService.getFingerprint).toHaveBeenCalledWith(
      mockKeys.encKey
    );

    expect(component.fingerprint()).toBe('TEST-FINGERPRINT-123');
  });

  it('should handle reset keys flow', async () => {
    const mockKeys = {
      encKey: new Uint8Array([1]),
      sigKey: new Uint8Array([2]),
    };
    mockCryptoService.loadMyPublicKeys.mockResolvedValue(mockKeys);
    mockCryptoService.getFingerprint.mockResolvedValue('NEW-FINGERPRINT');

    await component.onResetKeys();

    expect(mockDialog.open).toHaveBeenCalledWith(
      ConfirmationDialogComponent,
      expect.anything()
    );
    expect(mockChatService.resetIdentityKeys).toHaveBeenCalled();
    expect(mockCryptoService.loadMyPublicKeys).toHaveBeenCalledTimes(1);
  });

  it('should handle reset failure', async () => {
    mockChatService.resetIdentityKeys.mockRejectedValueOnce(new Error('Fail'));

    await component.onResetKeys();

    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      expect.stringContaining('Failed'),
      expect.any(String),
      expect.any(Object)
    );
  });
});
