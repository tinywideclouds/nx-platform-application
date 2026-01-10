import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IdentitySettingsPageComponent } from './identity-settings-page.component';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { ChatService } from '@nx-platform-application/messenger-state-app';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider, MockComponent } from 'ng-mocks';
import { IdentitySettingsContentComponent } from '../identity-settings-content/identity-settings-content.component';

describe('IdentitySettingsPageComponent', () => {
  let component: IdentitySettingsPageComponent;
  let fixture: ComponentFixture<IdentitySettingsPageComponent>;

  const mockUser = {
    id: 'urn:user:123',
    alias: 'Alice',
    email: 'alice@example.com',
    profileUrl: null,
  };
  const mockAuthService = { currentUser: signal(mockUser) };

  // Mock dependencies (though technically Content handles them, providers are needed if shallow render fails)
  const mockChatService = {
    showWizard: signal(true),
    setWizardActive: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdentitySettingsPageComponent],
      providers: [
        { provide: IAuthService, useValue: mockAuthService },
        { provide: ChatService, useValue: mockChatService },
        MockProvider(MessengerCryptoService),
        MockProvider(ChatLiveDataService),
      ],
    })
      .overrideComponent(IdentitySettingsPageComponent, {
        remove: { imports: [IdentitySettingsContentComponent] },
        add: { imports: [MockComponent(IdentitySettingsContentComponent)] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(IdentitySettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the Page Header', () => {
    const header = fixture.nativeElement.querySelector('header');
    expect(header.textContent).toContain('Identity');
  });

  it('should host the Content Component', () => {
    const content = fixture.nativeElement.querySelector(
      'lib-identity-settings-content',
    );
    expect(content).toBeTruthy();
  });
});
