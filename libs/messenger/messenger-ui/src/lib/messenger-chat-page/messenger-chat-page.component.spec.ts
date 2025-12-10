import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerChatPageComponent } from './messenger-chat-page.component';
import { Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

// Dependencies
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
  PendingIdentity,
} from '@nx-platform-application/contacts-storage';
import {
  ListFilterComponent,
  MasterDetailLayoutComponent,
} from '@nx-platform-application/platform-ui-toolkit';
import { ContactsSidebarComponent } from '@nx-platform-application/contacts-ui';
import { ChatConversationListComponent } from '@nx-platform-application/chat-ui';
import { MessageRequestReviewComponent } from '../message-request-review/message-request-review.component';

// ng-mocks
import { MockComponent, MockProvider } from 'ng-mocks';

// --- MOCK DATA ---
const friendUrn = URN.parse('urn:contacts:user:friend');
const strangerUrn = URN.parse('urn:contacts:user:stranger');

const mockSummaries = [
  {
    conversationUrn: friendUrn,
    latestSnippet: 'Hi',
    timestamp: '2023-01-01T00:00:00Z' as ISODateTimeString,
    unreadCount: 0,
  },
];

const mockContactList: Contact[] = [
  {
    id: friendUrn,
    alias: 'Bestie',
    firstName: 'Alice',
    surname: 'Wonderland',
    email: 'alice@test.com',
    phoneNumbers: [],
    emailAddresses: [],
    serviceContacts: { messenger: { profilePictureUrl: 'img.png' } } as any,
    lastModified: '2023-01-01T00:00:00Z' as ISODateTimeString,
  },
];

const mockPending: PendingIdentity[] = [
  {
    urn: strangerUrn,
    firstSeenAt: '2023-01-01T12:00:00Z' as ISODateTimeString,
  },
];

describe('MessengerChatPageComponent', () => {
  let component: MessengerChatPageComponent;
  let fixture: ComponentFixture<MessengerChatPageComponent>;
  let router: Router;
  let contactsService: ContactsStorageService;

  // Explicit mock for MatDialog
  const mockDialog = {
    open: vi.fn().mockReturnValue({
      afterClosed: () => of(true), // Simulate User clicking "Confirm"
    }),
  };

  // Observables for Router State
  const queryParams$ = new BehaviorSubject(convertToParamMap({}));

  // Signals/Subjects for Services
  const activeConversations = signal<any[]>([]);
  const selectedConversation = signal(null);
  const contacts$ = new BehaviorSubject<Contact[]>([]);
  const groups$ = new BehaviorSubject<ContactGroup[]>([]);
  const pending$ = new BehaviorSubject<PendingIdentity[]>([]);

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
        MockProvider(ChatService, {
          activeConversations,
          selectedConversation,
          loadConversation: vi.fn(),
          promoteQuarantinedMessages: vi.fn().mockResolvedValue(undefined),
          dismissPending: vi.fn().mockResolvedValue(undefined),
          block: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ContactsStorageService, {
          contacts$: contacts$,
          groups$: groups$,
          pending$: pending$,
          deletePending: vi.fn().mockResolvedValue(undefined),
          blockIdentity: vi.fn().mockResolvedValue(undefined),
          saveContact: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(Router),
        // Explicitly provide our mockDialog
        { provide: MatDialog, useValue: mockDialog },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParams$.asObservable(),
          },
        },
      ],
    })
      // Remove the real MatDialogModule so it doesn't overwrite our provider
      .overrideComponent(MessengerChatPageComponent, {
        remove: { imports: [MatDialogModule] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MessengerChatPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    contactsService = TestBed.inject(ContactsStorageService);

    // Spy on router.navigate
    vi.spyOn(router, 'navigate');

    // Seed Data
    activeConversations.set(mockSummaries);
    contacts$.next(mockContactList);
    pending$.next([]); // Start empty

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Requests Pane Logic', () => {
    it('should NOT show badge if no pending requests', () => {
      const badge = fixture.debugElement.query(
        By.css('button[matTooltip="Review Message Requests"]')
      );
      expect(badge).toBeFalsy();
    });

    it('should SHOW badge if pending requests exist', () => {
      pending$.next(mockPending);
      fixture.detectChanges();

      const badge = fixture.debugElement.query(
        By.css('button[matTooltip="Review Message Requests"]')
      );
      expect(badge).toBeTruthy();
    });

    it('should toggle requests pane and deselect chat when badge is clicked', () => {
      pending$.next(mockPending);
      fixture.detectChanges();

      const badge = fixture.debugElement.query(
        By.css('button[matTooltip="Review Message Requests"]')
      );
      const chatService = TestBed.inject(ChatService);

      // Act: Click Badge
      badge.nativeElement.click();
      fixture.detectChanges();

      expect(component.showRequestsPane()).toBe(true);
      expect(chatService.loadConversation).toHaveBeenCalledWith(null);

      // Verify Review Component is rendered in Main Area
      const reviewComp = fixture.debugElement.query(
        By.directive(MessageRequestReviewComponent)
      );
      expect(reviewComp).toBeTruthy();
    });
  });

  describe('Request Actions', () => {
    it('should route to Edit Contact on Accept', async () => {
      vi.stubGlobal('crypto', { randomUUID: () => 'new-uuid' });

      await component.onAcceptRequest(strangerUrn);

      expect(router.navigate).toHaveBeenCalledWith(
        ['/messenger/contacts/edit', 'urn:contacts:user:new-uuid'],
        expect.objectContaining({
          queryParams: { returnUrl: '/messenger/conversations' },
        })
      );
    });

    it('should call chatService.block on Block', async () => {
      const chatService = TestBed.inject(ChatService);

      await component.onBlockRequest({
        urn: strangerUrn,
        scope: 'messenger',
      });

      expect(chatService.block).toHaveBeenCalledWith(
        [strangerUrn],
        'messenger'
      );
    });

    it('should call chatService.dismissPending on Dismiss', async () => {
      const chatService = TestBed.inject(ChatService);

      await component.onDismissRequest(strangerUrn);

      expect(chatService.dismissPending).toHaveBeenCalledWith([strangerUrn]);
    });
  });

  describe('Routing Integration', () => {
    it('should close requests pane when selecting a conversation', () => {
      component.showRequestsPane.set(true);
      fixture.detectChanges();

      component.onConversationSelected(friendUrn);

      expect(component.showRequestsPane()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith([
        '/messenger',
        'conversations',
        friendUrn.toString(),
      ]);
    });
  });
});
