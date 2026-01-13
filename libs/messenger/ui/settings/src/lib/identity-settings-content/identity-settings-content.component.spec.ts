import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IdentitySettingsContentComponent } from './identity-settings-content.component';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { ChatService } from '@nx-platform-application/messenger-state-app';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';
import { URN } from '@nx-platform-application/platform-types';

describe('IdentitySettingsContentComponent', () => {
  let component: IdentitySettingsContentComponent;
  let fixture: ComponentFixture<IdentitySettingsContentComponent>;

  const mockUser = {
    id: URN.parse('urn:contacts:user:test'),
    alias: 'TestUser',
    email: 'test@test.com',
    profileUrl: 'http://avatar.com/u/test',
  };

  const mockChatService = {
    showWizard: signal(true),
    setWizardActive: vi.fn(),
  };

  const mockCryptoService = {
    loadMyPublicKeys: vi.fn().mockResolvedValue({ encKey: 'mock-key' }),
    getFingerprint: vi.fn().mockResolvedValue('05 05 05 05'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdentitySettingsContentComponent],
      providers: [
        MockProvider(IAuthService, { currentUser: signal(mockUser) }),
        { provide: ChatService, useValue: mockChatService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        MockProvider(ChatLiveDataService, { status$: of('connected') }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IdentitySettingsContentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should display core user profile data', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('TestUser');
    expect(text).toContain('test@test.com');
  });

  it('should load and display cryptographic fingerprint', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('05 05 05 05');
  });

  describe('Standard Mode (isWizard = false)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('isWizard', false);
      fixture.detectChanges();
    });

    it('should show the Wizard Toggle', () => {
      expect(
        fixture.nativeElement.querySelector('mat-slide-toggle'),
      ).toBeTruthy();
    });

    it('should NOT show wizard annotations', () => {
      expect(fixture.nativeElement.textContent).not.toContain(
        'Identity Established',
      );
    });
  });

  describe('Wizard Mode (isWizard = true)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('isWizard', true);
      fixture.detectChanges();
    });

    it('should HIDE the Wizard Toggle', () => {
      expect(
        fixture.nativeElement.querySelector('mat-slide-toggle'),
      ).toBeNull();
    });

    it('should show the Identity and Crypto annotations', async () => {
      await fixture.whenStable();
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Identity Established');
      expect(text).toContain('Crypto Active');
    });
  });
});
