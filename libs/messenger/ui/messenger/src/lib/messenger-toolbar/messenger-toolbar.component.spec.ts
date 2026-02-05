import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerToolbarComponent } from './messenger-toolbar.component';
import {
  User,
  URN,
  ConnectionStatus,
} from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { signal } from '@angular/core';

// ✅ State Facade Only
import { AppState } from '@nx-platform-application/messenger-state-app';
import { MockProvider } from 'ng-mocks';

const mockUser: User = {
  id: URN.parse('urn:contacts:user:me'),
  alias: 'Me',
  email: 'me@test.com',
};

describe('MessengerToolbarComponent', () => {
  let component: MessengerToolbarComponent;
  let fixture: ComponentFixture<MessengerToolbarComponent>;

  // Control Signals
  const networkStatusSig = signal<ConnectionStatus>('connected');
  const isBackingUpSig = signal(false);
  const isCloudAuthRequiredSig = signal(false);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessengerToolbarComponent, NoopAnimationsModule],
      providers: [
        // ✅ Mock AppState (The only source of truth)
        MockProvider(AppState, {
          networkStatus: networkStatusSig,
          isBackingUp: isBackingUpSig,
          isCloudAuthRequired: isCloudAuthRequiredSig,
          isCloudConnected: vi.fn().mockReturnValue(true),
          connectCloud: vi.fn(),
        }),
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
    it('should show OFFLINE when networkStatus is disconnected', () => {
      networkStatusSig.set('disconnected');
      fixture.detectChanges();

      expect(component.connectionStatus()).toBe('disconnected');
    });

    it('should show ATTENTION when cloud auth is required', () => {
      networkStatusSig.set('connected');
      isCloudAuthRequiredSig.set(true);
      fixture.detectChanges();

      expect(component.connectionStatus()).toBe('attention');
    });

    it('should show SYNCING when backing up', () => {
      networkStatusSig.set('connected');
      isCloudAuthRequiredSig.set(false);
      isBackingUpSig.set(true);
      fixture.detectChanges();

      expect(component.connectionStatus()).toBe('syncing');
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
