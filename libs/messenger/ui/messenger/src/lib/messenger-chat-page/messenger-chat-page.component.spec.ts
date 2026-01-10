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
import { MatDialog } from '@angular/material/dialog';

// Dependencies
import { ChatService } from '@nx-platform-application/messenger-state-app';
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
import { ChatConversationListComponent } from '@nx-platform-application/messenger-ui-chat';
import { MessageRequestReviewComponent } from '../message-request-review/message-request-review.component';

// ng-mocks
import { MockComponent, MockProvider } from 'ng-mocks';

const friendUrn = URN.parse('urn:contacts:user:friend');
const strangerUrn = URN.parse('urn:contacts:user:stranger');

describe('MessengerChatPageComponent', () => {
  let component: MessengerChatPageComponent;
  let fixture: ComponentFixture<MessengerChatPageComponent>;
  let router: Router;

  // Explicitly define the mock object to ensure it is returned
  const mockDialogRef = {
    afterClosed: vi.fn().mockReturnValue(of(true)), // Simulates 'Confirm'
  };
  const mockDialog = {
    open: vi.fn().mockReturnValue(mockDialogRef),
  };

  const queryParams$ = new BehaviorSubject(convertToParamMap({}));
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
        // Force the use of our explicit mock
        { provide: MatDialog, useValue: mockDialog },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParams$.asObservable(),
          },
        },
      ],
    })
      // We override to ensure the standalone component doesn't self-provide the real MatDialog
      .overrideComponent(MessengerChatPageComponent, {
        set: { providers: [{ provide: MatDialog, useValue: mockDialog }] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MessengerChatPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);

    vi.spyOn(router, 'navigate');

    // Seed Data
    activeConversations.set([
      {
        conversationUrn: friendUrn,
        latestSnippet: 'Hi',
        timestamp: '2023-01-01T00:00:00Z' as ISODateTimeString,
        unreadCount: 0,
      },
    ]);
    contacts$.next([]);
    pending$.next([]);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Request Actions', () => {
    it('should route to Edit Contact on Accept', async () => {
      vi.stubGlobal('crypto', { randomUUID: () => 'new-uuid' });

      await component.onAcceptRequest(strangerUrn);

      expect(router.navigate).toHaveBeenCalledWith(
        ['/messenger/contacts/edit', 'urn:contacts:user:new-uuid'],
        expect.objectContaining({
          queryParams: { returnUrl: '/messenger/conversations' },
        }),
      );
    });

    it('should call chatService.block on Block', async () => {
      const chatService = TestBed.inject(ChatService);

      await component.onBlockRequest({
        urn: strangerUrn,
        scope: 'messenger',
      });

      // Dialog opens
      expect(mockDialog.open).toHaveBeenCalled();
      // Service called
      expect(chatService.block).toHaveBeenCalledWith(
        [strangerUrn],
        'messenger',
      );
    });

    it('should call chatService.dismissPending on Dismiss', async () => {
      const chatService = TestBed.inject(ChatService);

      await component.onDismissRequest(strangerUrn);

      expect(chatService.dismissPending).toHaveBeenCalledWith([strangerUrn]);
    });
  });
});
