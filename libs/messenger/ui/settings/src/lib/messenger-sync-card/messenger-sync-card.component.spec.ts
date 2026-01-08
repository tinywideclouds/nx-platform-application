import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerSyncCardComponent } from './messenger-sync-card.component';
import { ChatService } from '@nx-platform-application/messenger-state-chat-session';
import { CloudSyncService } from '@nx-platform-application/messenger-state-cloud-sync';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';

describe('MessengerSyncCardComponent', () => {
  let component: MessengerSyncCardComponent;
  let fixture: ComponentFixture<MessengerSyncCardComponent>;

  const mockChatService = {
    clearLocalMessages: vi.fn(),
    fullDeviceWipe: vi.fn(),
  };

  const mockCloudSync = {
    isSyncing: signal(false),
    lastSyncResult: signal(null),
    connect: vi.fn().mockResolvedValue(true),
    syncNow: vi.fn(),
  };

  // Mock StorageService with the Signal confirmed by cloud-sync.service.spec.ts
  const mockStorageService = {
    isConnected: signal(true),
    disconnect: vi.fn().mockResolvedValue(true),
  };

  const mockDialog = {
    open: vi.fn().mockReturnValue({
      afterClosed: () => of(true),
    }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessengerSyncCardComponent],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: CloudSyncService, useValue: mockCloudSync },
        { provide: StorageService, useValue: mockStorageService },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerSyncCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should bind connection state to StorageService', () => {
    expect(component.isCloudEnabled()).toBe(true);
    mockStorageService.isConnected.set(false);
    fixture.detectChanges();
    expect(component.isCloudEnabled()).toBe(false);
  });

  describe('Actions', () => {
    it('should call connect and sync when toggled ON', async () => {
      await component.toggleCloudSync(true);
      expect(mockCloudSync.connect).toHaveBeenCalledWith('google');
      expect(mockCloudSync.syncNow).toHaveBeenCalled();
    });

    it('should call disconnect when toggled OFF', async () => {
      await component.toggleCloudSync(false);
      expect(mockStorageService.disconnect).toHaveBeenCalled();
    });

    it('should trigger secure logout', () => {
      component.onSecureLogout();
      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockChatService.fullDeviceWipe).toHaveBeenCalled();
    });
  });

  describe('Wizard Mode', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('mode', 'wizard');
      fixture.detectChanges();
    });

    it('should hide Header', () => {
      const header = fixture.nativeElement.querySelector('header');
      expect(header).toBeNull();
    });

    it('should show Local First Annotation', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Local-First Architecture');
    });
  });
});
