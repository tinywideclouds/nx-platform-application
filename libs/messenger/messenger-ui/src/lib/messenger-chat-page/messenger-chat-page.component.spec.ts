import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerChatPageComponent } from './messenger-chat-page.component';
import { Router } from '@angular/router';
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-storage';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

// ng-mocks
import { MockComponent, MockProvider } from 'ng-mocks';
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-toolkit';
import { ChatConversationListComponent } from '@nx-platform-application/chat-ui';
import { MessengerNetworkStatusComponent } from '../messenger-network-status/messenger-network-status.component';

const friendUrn = URN.parse('urn:contacts:user:friend');
const strangerUrn = URN.parse('urn:contacts:user:stranger');

const mockSummaries = [
  {
    conversationUrn: friendUrn,
    latestSnippet: 'Hi',
    timestamp: '2023-01-01T00:00:00Z' as ISODateTimeString,
    unreadCount: 0,
  },
  {
    conversationUrn: strangerUrn,
    latestSnippet: 'Spam',
    timestamp: '2023-01-01T00:00:00Z' as ISODateTimeString,
    unreadCount: 1,
  },
];

const mockContactList: Contact[] = [
  {
    id: friendUrn,
    alias: 'Bestie',
    firstName: 'B',
    surname: 'B',
    email: '',
    phoneNumbers: [],
    emailAddresses: [],
    serviceContacts: {},
  },
];

describe('MessengerChatPageComponent', () => {
  let component: MessengerChatPageComponent;
  let fixture: ComponentFixture<MessengerChatPageComponent>;
  let router: Router;

  // RxJS Subjects to drive signals
  const contacts$ = new BehaviorSubject<Contact[]>([]);
  const groups$ = new BehaviorSubject<any[]>([]);

  // Writable Signals for ChatService
  const activeConversations = signal<any[]>([]);
  const selectedConversation = signal(null);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MessengerChatPageComponent,
        MockComponent(MasterDetailLayoutComponent),
        MockComponent(ChatConversationListComponent),
        // FIX: Mock this to stop Dexie/Cloud Service from init
        MockComponent(MessengerNetworkStatusComponent),
      ],
      providers: [
        MockProvider(ChatService, {
          activeConversations,
          selectedConversation,
        }),
        MockProvider(ContactsStorageService, {
          contacts$: contacts$,
          groups$: groups$,
        }),
        MockProvider(Router),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerChatPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should FILTER OUT unknown contacts (Gatekeeper Check)', () => {
    activeConversations.set(mockSummaries);
    contacts$.next(mockContactList);
    fixture.detectChanges();

    const result = component.conversationsList();

    expect(result.length).toBe(1);
    expect(result[0].id.toString()).toBe(friendUrn.toString());

    const hasStranger = result.some(
      (c) => c.id.toString() === strangerUrn.toString()
    );
    expect(hasStranger).toBe(false);
  });
});
