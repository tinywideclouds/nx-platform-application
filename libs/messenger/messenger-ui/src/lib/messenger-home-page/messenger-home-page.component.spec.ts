import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerHomePageComponent } from './messenger-home-page.component';
import { RouterTestingModule } from '@angular/router/testing';
import { vi } from 'vitest';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { ChatService } from '@nx-platform-application/chat-state';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { By } from '@angular/platform-browser';

// Mocks
const mockAuthService = {
  currentUser: signal({
    id: 'user-123',
    alias: 'TestUser',
    email: 'test@test.com',
  }),
  logout: vi.fn().mockReturnValue(of(undefined)),
};

const mockChatService = {
  onboardingState: signal('READY'), // Default
};

describe('MessengerHomePageComponent', () => {
  let component: MessengerHomePageComponent;
  let fixture: ComponentFixture<MessengerHomePageComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MessengerHomePageComponent,
        RouterTestingModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: IAuthService, useValue: mockAuthService },
        { provide: ChatService, useValue: mockChatService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerHomePageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);

    vi.spyOn(router, 'navigate');

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should NOT show wizard when state is READY', () => {
    mockChatService.onboardingState.set('READY');
    fixture.detectChanges();

    const wizard = fixture.debugElement.query(
      By.css('messenger-device-link-wizard')
    );
    expect(wizard).toBeNull();
  });

  it('should SHOW wizard when state is REQUIRES_LINKING', () => {
    mockChatService.onboardingState.set('REQUIRES_LINKING');
    fixture.detectChanges();

    const wizard = fixture.debugElement.query(
      By.css('messenger-device-link-wizard')
    );
    expect(wizard).not.toBeNull();
  });

  it('should navigate to conversations on viewConversations', () => {
    component.onViewConversations();
    expect(router.navigate).toHaveBeenCalledWith([
      '/messenger',
      'conversations',
    ]);
  });

  it('should navigate to contacts on onViewContacts', () => {
    component.onViewContacts();
    expect(router.navigate).toHaveBeenCalledWith(['/messenger', 'contacts']);
  });
});
