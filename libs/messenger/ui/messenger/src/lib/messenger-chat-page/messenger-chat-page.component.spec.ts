import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerChatPageComponent } from './messenger-chat-page.component';
import { Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import { MatDialog } from '@angular/material/dialog';

// Dependencies
import { AppState } from '@nx-platform-application/messenger-state-app';
import {
  ChatDataService,
  UIConversation,
} from '@nx-platform-application/messenger-state-chat-data';
import { AddressBookManagementApi } from '@nx-platform-application/contacts-api';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';

// UI Components (Mocked)
import { ListFilterComponent } from '@nx-platform-application/platform-ui-toolkit';
import { ContactsSidebarComponent } from '@nx-platform-application/contacts-ui';
import { ChatConversationListComponent } from '@nx-platform-application/messenger-ui-chat';
import { MessageRequestReviewComponent } from '../message-request-review/message-request-review.component';
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-layouts';

// ng-mocks
import { MockComponent, MockProvider } from 'ng-mocks';

const friendUrn = URN.parse('urn:contacts:user:friend');
const strangerUrn = URN.parse('urn:contacts:user:stranger');

describe('MessengerChatPageComponent', () => {
  let component: MessengerChatPageComponent;
  let fixture: ComponentFixture<MessengerChatPageComponent>;
  let router: Router;

  // Mock Dialog
  const mockDialogRef = {
    afterClosed: vi.fn().mockReturnValue(of(true)),
  };
  const mockDialog = {
    open: vi.fn().mockReturnValue(mockDialogRef),
  };

  const queryParams$ = new BehaviorSubject(convertToParamMap({}));

  // Signals for Mocks
  const uiConversations = signal<UIConversation[]>([]);
  const selectedConversation = signal(null);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MessengerChatPageComponent,
        MockComponent(MasterDetailLayoutComponent),
        MockComponent(ChatConversationListComponent),
        MockComponent(ContactsSidebarComponent),
        MockComponent(ListFilterComponent),
        MockComponent(MessageRequestReviewComponent),
      ],
      providers: [
        // 1. App State
        MockProvider(AppState, {
          selectedConversation,
          loadConversation: vi.fn(),
          promoteQuarantinedMessages: vi.fn().mockResolvedValue(undefined),
          dismissPending: vi.fn().mockResolvedValue(undefined),
          block: vi.fn().mockResolvedValue(undefined),
          showWizard: signal(false),
          getQuarantinedMessages: vi.fn().mockResolvedValue([]),
        }),

        // 2. Chat Data (The new UI Source)
        MockProvider(ChatDataService, {
          uiConversations,
        }),

        // 3. Domain Services (Only what is actually injected)
        MockProvider(AddressBookManagementApi, {
          saveContact: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(QuarantineService, {
          getPendingRequests: vi.fn().mockResolvedValue([]),
        }),

        // 4. Platform/Router
        MockProvider(Router),
        { provide: MatDialog, useValue: mockDialog },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParams$.asObservable(),
          },
        },
      ],
    })
      .overrideComponent(MessengerChatPageComponent, {
        set: { providers: [{ provide: MatDialog, useValue: mockDialog }] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MessengerChatPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);

    vi.spyOn(router, 'navigate');

    // Seed Data (UIConversation)
    uiConversations.set([
      {
        conversationUrn: friendUrn,
        name: 'Friend',
        snippet: 'Hi',
        timestamp: new Date('2023-01-01T00:00:00Z'),
        unreadCount: 0,
        initials: 'F',
        pictureUrl: undefined,
        // Base Conversation properties
        id: friendUrn.toString(),
        lastMessage: 'Hi',
      } as any,
    ]);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('List Projection', () => {
    it('should expose conversations directly from the service signal', () => {
      const list = component.conversationsList();
      expect(list.length).toBe(1);
      expect(list[0].initials).toBe('F');
    });

    it('should filter locally by name when search query exists', () => {
      component.searchQuery.set('Zebra');
      const list = component.conversationsList();
      expect(list.length).toBe(0);
    });
  });

  describe('Request Actions', () => {
    it('should route to Edit Contact on Accept', async () => {
      vi.stubGlobal('crypto', { randomUUID: () => 'new-uuid' });
      const addressBook = TestBed.inject(AddressBookManagementApi);

      await component.onAcceptRequest(strangerUrn);

      expect(addressBook.saveContact).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(
        ['/messenger/contacts/edit', 'urn:contacts:user:new-uuid'],
        expect.objectContaining({
          queryParams: { returnUrl: '/messenger/conversations' },
        }),
      );
    });
  });
});
