import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KeySettingsContentComponent } from './key-settings-content.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { MockProvider } from 'ng-mocks';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

// ✅ NEW: Facade
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';

describe('KeySettingsContentComponent', () => {
  let component: KeySettingsContentComponent;
  let fixture: ComponentFixture<KeySettingsContentComponent>;
  let facade: ChatIdentityFacade;

  const mockRouter = { navigate: vi.fn() };

  const mockFacade = {
    clearPublicKeyCache: vi.fn().mockResolvedValue(undefined),
    performIdentityReset: vi.fn().mockResolvedValue(undefined),
  };

  const mockDialog = {
    open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [KeySettingsContentComponent],
      providers: [
        // ✅ Mock Facade instead of AppState/Infra
        { provide: ChatIdentityFacade, useValue: mockFacade },
        { provide: Router, useValue: mockRouter },
        { provide: MatDialog, useValue: mockDialog },
        MockProvider(MatSnackBar),
        MockProvider(Logger),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(KeySettingsContentComponent);
    component = fixture.componentInstance;
    facade = TestBed.inject(ChatIdentityFacade);
    fixture.detectChanges();
  });

  it('should navigate to link-device on button click', () => {
    component.onLinkDevice();
    expect(mockRouter.navigate).toHaveBeenCalledWith([
      '/messenger',
      'settings',
      'link-device',
    ]);
  });

  it('should delegate cache clearing to the Facade', async () => {
    await component.onClearKeyCache();
    expect(facade.clearPublicKeyCache).toHaveBeenCalled();
  });

  it('should delegate identity reset to the Facade', async () => {
    // Triggers confirmation dialog (mocked to return true)
    await component.onResetIdentity();
    expect(facade.performIdentityReset).toHaveBeenCalled();
  });

  it('should show "Device Graph" annotation only in wizard mode', () => {
    fixture.componentRef.setInput('isWizard', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Device Graph');

    fixture.componentRef.setInput('isWizard', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Device Graph');
  });
});
