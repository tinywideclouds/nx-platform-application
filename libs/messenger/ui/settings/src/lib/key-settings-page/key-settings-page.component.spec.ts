import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KeySettingsPageComponent } from './key-settings-page.component';
import { ChatService } from '@nx-platform-application/messenger-state-chat-session';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { Logger } from '@nx-platform-application/console-logger';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { signal } from '@angular/core';

describe('KeySettingsPageComponent', () => {
  let component: KeySettingsPageComponent;
  let fixture: ComponentFixture<KeySettingsPageComponent>;

  // 1. Manual Spy Objects (Guaranteed to work)
  const dialogSpy = {
    open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }),
  };

  const snackBarSpy = {
    open: vi.fn(),
  };

  const mockUserUrn = URN.parse('urn:contacts:user:test');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeySettingsPageComponent],
      providers: [
        MockProvider(ChatService, {
          currentUserUrn: signal(mockUserUrn),
          resetIdentityKeys: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(MessengerCryptoService, {
          loadMyPublicKeys: vi.fn().mockResolvedValue({
            encKey: new Uint8Array(),
            sigKey: new Uint8Array(),
          }),
          getFingerprint: vi.fn().mockResolvedValue('TEST-FINGERPRINT-123'),
        }),
        // 2. Use useValue to force override
        { provide: MatDialog, useValue: dialogSpy },
        { provide: MatSnackBar, useValue: snackBarSpy },
        MockProvider(Logger),
      ],
    })
      // 3. Strip real modules to prevent side-effects
      .overrideComponent(KeySettingsPageComponent, {
        remove: { imports: [MatDialogModule, MatSnackBarModule] },
        add: { imports: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(KeySettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load and display fingerprint automatically', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    // Test the text content to be sure
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('TEST-FINGERPRINT-123');
  });

  it('should handle reset keys flow', async () => {
    const chatService = TestBed.inject(ChatService);

    await component.onResetKeys();

    expect(dialogSpy.open).toHaveBeenCalledWith(
      ConfirmationDialogComponent,
      expect.anything(),
    );
    expect(chatService.resetIdentityKeys).toHaveBeenCalled();
    expect(snackBarSpy.open).toHaveBeenCalled();
  });
});
