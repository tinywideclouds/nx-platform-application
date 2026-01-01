import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerSyncCardComponent } from './messenger-sync-card.component';
import {
  CloudSyncService,
  SyncResult,
} from '@nx-platform-application/messenger-state-cloud-sync';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MockProvider } from 'ng-mocks';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('MessengerSyncCardComponent', () => {
  let component: MessengerSyncCardComponent;
  let fixture: ComponentFixture<MessengerSyncCardComponent>;

  // Mock Service State
  let mockSyncService: {
    isSyncing: any;
    lastSyncResult: any;
    syncNow: any;
  };

  beforeEach(async () => {
    mockSyncService = {
      isSyncing: signal(false),
      lastSyncResult: signal<SyncResult | null>(null),
      syncNow: vi.fn().mockResolvedValue({ success: true, errors: [] }),
    };

    await TestBed.configureTestingModule({
      imports: [MessengerSyncCardComponent],
      providers: [
        { provide: CloudSyncService, useValue: mockSyncService },
        MockProvider(MatSnackBar),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerSyncCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to syncing both Contacts and Messages', () => {
    expect(component.syncContacts()).toBe(true);
    expect(component.syncMessages()).toBe(true);
  });

  it('should trigger sync service with correct options', async () => {
    // 1. Arrange: User unchecks messages
    component.syncMessages.set(false);

    // 2. Act
    await component.triggerSync();

    // 3. Assert
    expect(mockSyncService.syncNow).toHaveBeenCalledWith({
      providerId: 'google',
      syncContacts: true,
      syncMessages: false,
    });
  });

  it('should disable button when syncing', () => {
    mockSyncService.isSyncing.set(true);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button');
    expect(btn.disabled).toBe(true);
  });

  it('should disable button when no options selected', () => {
    component.syncContacts.set(false);
    component.syncMessages.set(false);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button');
    expect(btn.disabled).toBe(true);
  });
});
