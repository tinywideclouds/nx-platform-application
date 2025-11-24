// libs/messenger/settings-ui/src/lib/key-settings-page/key-settings-page.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KeySettingsPageComponent } from './key-settings-page.component';
import { ChatService } from '@nx-platform-application/chat-state';
import { Logger } from '@nx-platform-application/console-logger';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';

describe('KeySettingsPageComponent', () => {
  let component: KeySettingsPageComponent;
  let fixture: ComponentFixture<KeySettingsPageComponent>;

  const mockChatService = {
    resetIdentityKeys: vi.fn().mockResolvedValue(undefined)
  };
  const mockLogger = { info: vi.fn(), error: vi.fn() };
  const mockSnackBar = { open: vi.fn() };
  
  // Mock Dialog Ref
  const mockDialogRef = { afterClosed: () => of(true) };
  const mockDialog = { 
    open: vi.fn().mockReturnValue(mockDialogRef) 
  };

  beforeEach(async () => {
    // Mock globals
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [KeySettingsPageComponent],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: Logger, useValue: mockLogger },
        // These providers in the array are being overshadowed by the Component Imports
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: MatDialog, useValue: mockDialog }
      ]
    })
    // Force overrides for services provided by Modules imported in the Standalone Component
    .overrideProvider(MatDialog, { useValue: mockDialog })
    .overrideProvider(MatSnackBar, { useValue: mockSnackBar }) // <--- ADD THIS
    .compileComponents();

    fixture = TestBed.createComponent(KeySettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open dialog and then call resetIdentityKeys', async () => {
    // 1. Call the async method and await it
    await component.onResetKeys();
    
    // 2. Verify Dialog interactions
    expect(mockDialog.open).toHaveBeenCalledWith(ConfirmationDialogComponent, expect.anything());

    // 3. Verify Service interactions
    expect(mockChatService.resetIdentityKeys).toHaveBeenCalled();

    // 4. Verify Feedback
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      expect.stringContaining('regenerated'), 
      expect.any(String), 
      expect.any(Object)
    );
  });

  it('should log error on failure', async () => {
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