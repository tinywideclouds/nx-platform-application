import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerChatPageComponent } from './messenger-chat-page.component';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-storage';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

// Mocks
const mockChatService = {
  activeConversations: signal<any[]>([]),
  selectedConversation: signal(null),
};

const mockContactsService = {
  contacts$: of([]),
  groups$: of([]),
};

// Fixtures
const friendUrn = URN.parse('urn:sm:user:friend');
const strangerUrn = URN.parse('urn:sm:user:stranger');

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

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [
        MessengerChatPageComponent,
        RouterTestingModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: ContactsStorageService, useValue: mockContactsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerChatPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);

    vi.spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should FILTER OUT unknown contacts (Gatekeeper Check)', async () => {
    // 1. Setup Data
    mockChatService.activeConversations.set(mockSummaries);
    // We need to update the private toSignal manually or mock the observable source better.
    // Since toSignal is read in constructor, we use Object.defineProperty or a ReplaySubject in a real setup.
    // For this simple mock structure, we can force a refresh if we used writable signals for contacts in the mock,
    // but since we used 'of()', we should override the property for testing logic.

    // Hack for testing toSignal private property update without complex setup:
    (component as any).allContacts = signal(mockContactList);
    (component as any).allGroups = signal([]); // Empty groups

    // 2. Trigger Computation
    fixture.detectChanges();
    const result = component.conversationsList();

    // 3. Verify
    expect(result.length).toBe(1);
    expect(result[0].id.toString()).toBe(friendUrn.toString());
    expect(result[0].name).toBe('Bestie');

    // Stranger should be gone
    const hasStranger = result.some(
      (c) => c.id.toString() === strangerUrn.toString()
    );
    expect(hasStranger).toBe(false);
  });

  it('should navigate to absolute path on conversation select', () => {
    component.onConversationSelected(friendUrn);

    expect(router.navigate).toHaveBeenCalledWith([
      '/messenger',
      'conversations',
      friendUrn.toString(),
    ]);
  });
});
