import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataSettingsContentComponent } from './data-settings-content.component';
import { AppState } from '@nx-platform-application/messenger-state-app';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MockComponent, MockProvider } from 'ng-mocks';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MessengerSyncCardComponent } from '../messenger-sync-card/messenger-sync-card.component';

// ✅ NEW: Directory API
import { DirectoryManagementApi } from '@nx-platform-application/directory-api';

describe('DataSettingsContentComponent', () => {
  let component: DataSettingsContentComponent;
  let fixture: ComponentFixture<DataSettingsContentComponent>;

  const mockAppState = {
    clearLocalMessages: vi.fn().mockResolvedValue(undefined),
    clearLocalContacts: vi.fn().mockResolvedValue(undefined),
    fullDeviceWipe: vi.fn().mockResolvedValue(undefined),
  };

  const mockDirectory = {
    clear: vi.fn().mockResolvedValue(undefined),
  };

  const mockDialog = {
    open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataSettingsContentComponent],
      providers: [
        { provide: AppState, useValue: mockAppState },
        { provide: DirectoryManagementApi, useValue: mockDirectory }, // ✅
        { provide: MatDialog, useValue: mockDialog },
        MockProvider(MatSnackBar),
        MockProvider(Logger),
      ],
    })
      .overrideComponent(DataSettingsContentComponent, {
        add: { imports: [MockComponent(MessengerSyncCardComponent)] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DataSettingsContentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should call clearLocalContacts when requested', async () => {
    await component.onClearContacts();
    expect(mockAppState.clearLocalContacts).toHaveBeenCalled();
  });

  it('should call directory.clear when requested', async () => {
    await component.onClearDirectory();
    expect(mockDirectory.clear).toHaveBeenCalled();
  });

  it('should call fullDeviceWipe when secure logout is requested', async () => {
    await component.onSecureLogout();
    expect(mockAppState.fullDeviceWipe).toHaveBeenCalled();
  });
});
