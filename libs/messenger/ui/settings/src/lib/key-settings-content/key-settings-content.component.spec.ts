import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KeySettingsContentComponent } from './key-settings-content.component';
import { ChatService } from '@nx-platform-application/messenger-state-app';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { MockProvider } from 'ng-mocks';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Logger } from '@nx-platform-application/console-logger';

describe('KeySettingsContentComponent', () => {
  let component: KeySettingsContentComponent;
  let fixture: ComponentFixture<KeySettingsContentComponent>;

  const mockRouter = { navigate: vi.fn() };
  const mockKeyCache = { clear: vi.fn().mockResolvedValue(undefined) };
  const mockDialog = {
    open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeySettingsContentComponent],
      providers: [
        MockProvider(ChatService),
        { provide: KeyCacheService, useValue: mockKeyCache },
        { provide: Router, useValue: mockRouter },
        { provide: MatDialog, useValue: mockDialog },
        MockProvider(MatSnackBar),
        MockProvider(Logger),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(KeySettingsContentComponent);
    component = fixture.componentInstance;
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

  it('should clear key cache and show snackbar', async () => {
    await component.onClearKeyCache();
    expect(mockKeyCache.clear).toHaveBeenCalled();
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
