import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IdentitySettingsContentComponent } from './identity-settings-content.component';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { AppState } from '@nx-platform-application/messenger-state-app';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';

// ✅ NEW: Correct State Layers
import { ChatDataService } from '@nx-platform-application/messenger-state-chat-data';
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';

describe('IdentitySettingsContentComponent', () => {
  let component: IdentitySettingsContentComponent;
  let fixture: ComponentFixture<IdentitySettingsContentComponent>;

  const mockUser = {
    id: URN.parse('urn:contacts:user:test'),
    alias: 'TestUser',
    email: 'test@test.com',
    profileUrl: 'http://avatar.com/u/test',
  };

  const mockAppState = {
    showWizard: signal(true),
    setWizardActive: vi.fn(),
  };

  // ✅ Mock ChatDataService (The Owner of Connection State)
  const mockChatData = {
    liveConnection: of('connected'),
  };

  // ✅ Mock IdentityFacade (The Owner of Fingerprints)
  const mockIdentityFacade = {
    loadMyFingerprint: vi.fn().mockResolvedValue('05 05 05 05'),
    currentUser: signal(mockUser),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdentitySettingsContentComponent],
      providers: [
        MockProvider(IAuthService, { currentUser: signal(mockUser) }),
        { provide: AppState, useValue: mockAppState },
        // ✅ Correct Providers
        { provide: ChatDataService, useValue: mockChatData },
        { provide: ChatIdentityFacade, useValue: mockIdentityFacade },
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

  it('should load fingerprint via IdentityFacade', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('05 05 05 05');
    expect(mockIdentityFacade.loadMyFingerprint).toHaveBeenCalled();
  });

  describe('Wizard Mode (isWizard = true)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('isWizard', true);
      fixture.detectChanges();
    });

    it('should show the Identity annotations', async () => {
      await fixture.whenStable();
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Identity Established');
    });
  });
});
