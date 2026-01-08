import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StorageSettingsCardComponent } from './storage-settings-card.component';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { Logger } from '@nx-platform-application/console-logger';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('StorageSettingsCardComponent', () => {
  let component: StorageSettingsCardComponent;
  let fixture: ComponentFixture<StorageSettingsCardComponent>;

  const mockStorage = {
    isConnected: signal(false),
    activeProviderId: signal(null),
    getAvailableOptions: () => [{ id: 'google', name: 'Google Drive' }],
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  const mockLogger = {
    error: vi.fn(),
    info: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorageSettingsCardComponent],
      providers: [
        { provide: StorageService, useValue: mockStorage },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StorageSettingsCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show connect buttons when offline', () => {
    mockStorage.isConnected.set(false);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button');
    expect(btn.textContent).toContain('Connect Google Drive');
  });

  it('should call snackbar on failed connection', async () => {
    mockStorage.isConnected.set(false);
    mockStorage.connect.mockResolvedValue(false); // Simulate cancellation

    await component.connect('google');

    expect(mockStorage.connect).toHaveBeenCalledWith('google');
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      expect.stringContaining('failed'),
      expect.any(String),
      expect.any(Object),
    );
  });

  it('should call snackbar on success', async () => {
    mockStorage.isConnected.set(false);
    mockStorage.connect.mockResolvedValue(true);

    await component.connect('google');

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      expect.stringContaining('Connected'),
      'OK',
      expect.any(Object),
    );
  });
});
