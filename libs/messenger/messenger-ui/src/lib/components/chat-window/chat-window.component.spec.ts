import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
// 1. IMPORT 'Observable'
import { of, ReplaySubject, Observable } from 'rxjs';
import { vi } from 'vitest';

import { ChatWindowComponent } from './chat-window.component';

// --- Mocks ---
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import {
  ChatMessage,
  ChatParticipant,
} from '@nx-platform-application/messenger-types';
import { ISODateTimeString, URN } from '@nx-platform-application/platform-types';

// --- Fixtures ---
const MOCK_CURRENT_USER_URN = URN.parse('urn:sm:user:me');
const MOCK_CONTACT_URN = URN.parse('urn:sm:user:contact-123');
const MOCK_GROUP_URN = URN.parse('urn:sm:group:group-456');

const MOCK_CONTACT: Contact = {
  id: 'urn:sm:user:contact-123',
  alias: 'Mock Contact',
  firstName: 'Mock',
  surname: 'Contact',
  email: 'test@example.com',
  emailAddresses: [],
  phoneNumbers: [],
  serviceContacts: {
    "messenger": {
      id: 'service:messenger:contact-123',
      alias: 'Mock Contact',
      lastSeen: new Date().toISOString() as ISODateTimeString,
      profilePictureUrl: 'http://pic.url/contact.png',
    },
  },
};

const MOCK_GROUP: ContactGroup = {
  id: 'urn:sm:group:group-456',
  name: 'Mock Group',
  contactIds: ['urn:sm:user:contact-123'],
};

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    conversationUrn: MOCK_CONTACT_URN,
    senderId: MOCK_CONTACT_URN,
    timestamp: new Date(),
    textContent: 'Their reply',
    type: 'text',
  },
  {
    id: 'msg-2',
    conversationUrn: MOCK_CONTACT_URN,
    senderId: MOCK_CURRENT_USER_URN,
    timestamp: new Date(),
    textContent: 'My test message',
    type: 'text',
  },
];

// --- Mock Services ---
let mockChatService: {
  loadConversation: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  messages: WritableSignal<ChatMessage[]>;
  currentUserUrn: WritableSignal<URN | null>;
};

//
// 2. THIS IS THE FIX:
//    Be explicit about the Observable types.
//
let mockContactsService: {
  contacts$: Observable<Contact[]>;
  groups$: Observable<ContactGroup[]>;
};

// Mock for ActivatedRoute
let paramMapSubject: ReplaySubject<ReturnType<typeof convertToParamMap>>;

describe('ChatWindowComponent', () => {
  let component: ChatWindowComponent;
  let fixture: ComponentFixture<ChatWindowComponent>;
  let nativeElement: HTMLElement;

  beforeEach(async () => {
    // --- Define Mocks ---
    paramMapSubject = new ReplaySubject(1);

    mockChatService = {
      loadConversation: vi.fn(),
      sendMessage: vi.fn(),
      messages: signal<ChatMessage[]>([]),
      currentUserUrn: signal<URN | null>(null),
    };

    mockContactsService = {
      contacts$: of([MOCK_CONTACT]),
      groups$: of([MOCK_GROUP]),
    };

    await TestBed.configureTestingModule({
      imports: [ChatWindowComponent, RouterTestingModule, FormsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMapSubject.asObservable() },
        },
        { provide: ChatService, useValue: mockChatService },
        { provide: ContactsStorageService, useValue: mockContactsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatWindowComponent);
    component = fixture.componentInstance;
    nativeElement = fixture.nativeElement;
  });

  it('should create', async () => {
    // Set initial route and trigger change detection
    paramMapSubject.next(convertToParamMap({ id: MOCK_CONTACT_URN.toString() }));
    await fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should call loadConversation when route param changes', async () => {
    paramMapSubject.next(convertToParamMap({ id: MOCK_CONTACT_URN.toString() }));
    await fixture.detectChanges();

    expect(mockChatService.loadConversation).toHaveBeenCalledWith(
      MOCK_CONTACT_URN
    );
  });

  it('should compute participant for a USER', async () => {
    paramMapSubject.next(convertToParamMap({ id: MOCK_CONTACT_URN.toString() }));
    await fixture.detectChanges();

    const expectedParticipant: ChatParticipant = {
      urn: MOCK_CONTACT_URN,
      name: 'Mock Contact',
      initials: 'MC',
      profilePictureUrl: 'http://pic.url/contact.png',
    };

    expect(component.participant()).toEqual(expectedParticipant);

    // Check DOM
    const headerEl = nativeElement.querySelector('header');
    expect(headerEl?.textContent).toContain('Mock Contact');
    const img = headerEl?.querySelector('img');
    expect(img?.src).toBe('http://pic.url/contact.png');
  });

  it('should compute participant for a GROUP', async () => {
    paramMapSubject.next(convertToParamMap({ id: MOCK_GROUP_URN.toString() }));
    await fixture.detectChanges();

    const expectedParticipant: ChatParticipant = {
      urn: MOCK_GROUP_URN,
      name: 'Mock Group',
      initials: 'G',
    };

    expect(component.participant()).toEqual(expectedParticipant);

    // Check DOM
    const headerEl = nativeElement.querySelector('header');
    expect(headerEl?.textContent).toContain('Mock Group');
    expect(headerEl?.textContent).toContain('G'); // Initials
    const img = headerEl?.querySelector('img');
    expect(img).toBeFalsy(); // No profile pic
  });

  it('should render incoming and outgoing messages', async () => {
    // Arrange
    mockChatService.messages.set(MOCK_MESSAGES);
    mockChatService.currentUserUrn.set(MOCK_CURRENT_USER_URN);

    // Act
    paramMapSubject.next(convertToParamMap({ id: MOCK_CONTACT_URN.toString() }));
    await fixture.detectChanges();

    // Assert
    const outgoing = nativeElement.querySelectorAll(
      '.flex.justify-end .bg-blue-600'
    );
    const incoming = nativeElement.querySelectorAll('.bg-white.border');

    expect(outgoing.length).toBe(1);
    expect(incoming.length).toBe(1);
    expect(outgoing[0].textContent).toContain('My test message');
    expect(incoming[0].textContent).toContain('Their reply');
  });

  it('should clear input text onSendMessage', async () => {
    paramMapSubject.next(convertToParamMap({ id: MOCK_CONTACT_URN.toString() }));
    await fixture.detectChanges();

    // Arrange
    component.newMessageText = '  Hello!  ';
    await fixture.detectChanges(); // Update ngModel

    const inputEl = nativeElement.querySelector('input') as HTMLInputElement;
    expect(inputEl.value).toBe('  Hello!  ');

    // Act
    const sendButton = nativeElement.querySelector(
      'footer button'
    ) as HTMLButtonElement;
    sendButton.click();
    await fixture.detectChanges();

    // Assert
    expect(component.newMessageText).toBe('');
    expect(inputEl.value).toBe('');
    // We don't test the service call because it's commented out in the component
    expect(mockChatService.sendMessage).not.toHaveBeenCalled();
  });

  it('should navigate back when onBack is called', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    paramMapSubject.next(convertToParamMap({ id: MOCK_CONTACT_URN.toString() }));
    await fixture.detectChanges();

    const backButton = nativeElement.querySelector(
      'header button' // First button in header is "back"
    ) as HTMLButtonElement;

    backButton.click();
    await fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(['/messenger']);
  });
});