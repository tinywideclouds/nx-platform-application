// libs/messenger/messenger-ui/src/lib/messenger-home-page/messenger-home-page.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MessengerHomePageComponent } from './messenger-home-page.component';

// Mocks
import { ChatService } from '@nx-platform-application/chat-state';
import { ContactsStorageService } from '@nx-platform-application/contacts-data-access';
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/console-logger';
import { MatDialog } from '@angular/material/dialog';

const mockChatService = {
  activeConversations: signal([]),
  selectedConversation: signal(null),
  loadConversation: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined), // Mock logout
};

const mockContactsService = {
  contacts$: of([]),
  groups$: of([]),
};

const mockAuthService = {
  currentUser: signal({ id: URN.parse('urn:sm:user:me'), alias: 'Me' }),
};

const mockDialogRef = {
  afterClosed: vi.fn(),
};

const mockDialog = {
  open: vi.fn().mockReturnValue(mockDialogRef),
};

describe('MessengerHomePageComponent', () => {
  let component: MessengerHomePageComponent;
  let fixture: ComponentFixture<MessengerHomePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessengerHomePageComponent, RouterTestingModule],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: IAuthService, useValue: mockAuthService },
        { provide: Logger, useValue: { info: vi.fn() } },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerHomePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open dialog on logout click', () => {
    mockDialogRef.afterClosed.mockReturnValue(of(false)); // Cancelled

    component.onLogoutClick();

    expect(mockDialog.open).toHaveBeenCalled();
    // Should NOT logout if cancelled
    expect(mockChatService.logout).not.toHaveBeenCalled();
  });

  it('should perform logout only if dialog confirms', () => {
    mockDialogRef.afterClosed.mockReturnValue(of(true)); // Confirmed

    component.onLogoutClick();

    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockChatService.logout).toHaveBeenCalled();
  });
});