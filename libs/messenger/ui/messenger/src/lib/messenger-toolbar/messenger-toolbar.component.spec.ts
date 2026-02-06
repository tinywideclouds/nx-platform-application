import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerToolbarComponent } from './messenger-toolbar.component';
import {
  User,
  URN,
  ConnectionStatus,
} from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MockProvider } from 'ng-mocks';

// Services
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { CloudSyncService } from '@nx-platform-application/messenger-state-cloud-sync';

const mockUser: User = {
  id: URN.parse('urn:contacts:user:me'),
  alias: 'Me',
  email: 'me@test.com',
};

describe('MessengerToolbarComponent', () => {
  let component: MessengerToolbarComponent;
  let fixture: ComponentFixture<MessengerToolbarComponent>;

  // Mock Streams
  const liveStatus$ = new BehaviorSubject<ConnectionStatus>('connected');

  // Control Signals (CloudSync)
  const isSyncingSig = signal(false);
  const isAuthRequiredSig = signal(false);
  const isConnectedSig = signal(false);

  // Mocks
  const mockRouter = { navigate: vi.fn() };
  const mockSnackBar = {
    open: vi.fn().mockReturnValue({
      onAction: () => ({ subscribe: vi.fn() }),
    }),
  };

  beforeEach(async () => {
    // Reset streams & signals
    liveStatus$.next('connected');
    isSyncingSig.set(false);
    isAuthRequiredSig.set(false);
    isConnectedSig.set(true);

    await TestBed.configureTestingModule({
      imports: [MessengerToolbarComponent, NoopAnimationsModule],
      providers: [
        MockProvider(ChatLiveDataService, {
          status$: liveStatus$,
        }),
        // ✅ NEW: Mock CloudSyncService instead of AppState
        MockProvider(CloudSyncService, {
          isSyncing: isSyncingSig,
          requiresUserInteraction: isAuthRequiredSig,
          isConnected: isConnectedSig,
          connect: vi.fn(),
        }),
        { provide: Router, useValue: mockRouter },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerToolbarComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('currentUser', mockUser);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Status Logic', () => {
    it('should show OFFLINE when LiveService reports disconnected', () => {
      liveStatus$.next('disconnected');
      fixture.detectChanges();
      expect(component.connectionStatus()).toBe('disconnected');
    });

    it('should show ATTENTION when cloud auth is required (and online)', () => {
      liveStatus$.next('connected');
      isAuthRequiredSig.set(true); // Set via CloudSync
      fixture.detectChanges();
      expect(component.connectionStatus()).toBe('attention');
    });

    it('should show SYNCING when backing up (and online + authenticated)', () => {
      liveStatus$.next('connected');
      isAuthRequiredSig.set(false);
      isSyncingSig.set(true); // Set via CloudSync
      fixture.detectChanges();
      expect(component.connectionStatus()).toBe('syncing');
    });

    it('should show CONNECTED when healthy', () => {
      liveStatus$.next('connected');
      isAuthRequiredSig.set(false);
      isSyncingSig.set(false);
      fixture.detectChanges();
      expect(component.connectionStatus()).toBe('connected');
    });
  });

  describe('Action Handling', () => {
    it('should navigate to settings if healthy', () => {
      component.handleNetworkAction();
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/messenger',
        'settings',
        'identity',
      ]);
    });

    it('should trigger cloud connect if auth is required', () => {
      isAuthRequiredSig.set(true);
      fixture.detectChanges();
      const syncService = TestBed.inject(CloudSyncService);

      component.handleNetworkAction();
      expect(syncService.connect).toHaveBeenCalledWith('google-drive');
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  it('should render user initials', () => {
    fixture.componentRef.setInput('currentUser', {
      ...mockUser,
      profileUrl: undefined,
    });
    fixture.detectChanges();

    const avatar = fixture.debugElement.query(
      By.css('.rounded-full.bg-gray-600'),
    );
    expect(avatar.nativeElement.textContent).toContain('ME');
  });
});
