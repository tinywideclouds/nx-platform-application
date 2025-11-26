// libs/messenger/messenger-ui/src/lib/chat-window/chat-window.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatWindowComponent } from './chat-window.component';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject, of } from 'rxjs';
import { signal } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { vi } from 'vitest';

// Services
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';

// Child Mocks
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ChatWindowHeaderComponent } from '../chat-window-header/chat-window-header.component';

@Component({
  selector: 'messenger-chat-window-header',
  standalone: true,
  template: '<div>Header</div>',
})
class MockHeaderComponent {
  @Input() participant: any;
  @Input() mode: any;
  @Input() hasKeyIssue: any;
  @Output() back = new EventEmitter<void>();
  @Output() toggleInfo = new EventEmitter<void>();
}

// Fixtures
const mockContactUrn = URN.parse('urn:sm:user:alice');
const mockContact: Contact = {
  id: mockContactUrn,
  alias: 'Alice',
  email: 'alice@test.com',
  firstName: 'Alice',
  surname: 'Wonderland',
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: { messenger: { profilePictureUrl: 'img.png' } } as any,
};

// Service Mocks
const mockChatService = {
  loadConversation: vi.fn(),
  selectedConversation: signal(null),
  currentUserUrn: signal(null),
  messages: signal([]),
  isRecipientKeyMissing: signal(false),
};

const mockContactsService = {
  contacts$: of([mockContact]),
  groups$: of([]),
};

const mockLogger = { error: vi.fn() };

describe('ChatWindowComponent', () => {
  let component: ChatWindowComponent;
  let fixture: ComponentFixture<ChatWindowComponent>;
  let router: Router;
  let routerEvents$: Subject<any>;
  let routeParamMap$: Subject<any>;
  let currentUrl = '/chat/123';

  beforeEach(async () => {
    routerEvents$ = new Subject();
    routeParamMap$ = new Subject();
    currentUrl = '/chat/123';

    await TestBed.configureTestingModule({
      imports: [ChatWindowComponent, RouterTestingModule],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: Logger, useValue: mockLogger },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: routeParamMap$, snapshot: {} },
        },
      ],
    })
      .overrideComponent(ChatWindowComponent, {
        remove: { imports: [ChatWindowHeaderComponent] },
        add: { imports: [MockHeaderComponent] },
      })
      .compileComponents();

    // FIX: Setup Router Mocks BEFORE creating the component.
    // The component reads 'router.url' in its constructor (via toSignal initialValue).
    router = TestBed.inject(Router);
    Object.defineProperty(router, 'events', { value: routerEvents$ });
    Object.defineProperty(router, 'url', { get: () => currentUrl });
    vi.spyOn(router, 'navigate');

    fixture = TestBed.createComponent(ChatWindowComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load conversation when route ID changes', async () => {
    routeParamMap$.next({ get: () => mockContactUrn.toString() });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockChatService.loadConversation).toHaveBeenCalledWith(
      mockContactUrn
    );
  });

  it('should calculate participant correctly', () => {
    routeParamMap$.next({ get: () => mockContactUrn.toString() });
    fixture.detectChanges();

    const participant = component.participant();
    expect(participant).toBeTruthy();
    expect(participant?.name).toBe('Alice');
    expect(participant?.profilePictureUrl).toBe('img.png');
  });

  it('should detect "details" view mode from router', async () => {
    // 1. Change URL state
    currentUrl = '/chat/123/details';

    // 2. Trigger event
    routerEvents$.next(
      new NavigationEnd(1, '/chat/123/details', '/chat/123/details')
    );

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.viewMode()).toBe('details');
  });

  it('should detect "chat" view mode from router', async () => {
    currentUrl = '/chat/123';
    routerEvents$.next(new NavigationEnd(1, '/chat/123', '/chat/123'));

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.viewMode()).toBe('chat');
  });

  it('should navigate UP when onHeaderBack called in details mode', async () => {
    // Setup: Details Mode
    currentUrl = '/chat/123/details';
    routerEvents$.next(
      new NavigationEnd(1, '/chat/123/details', '/chat/123/details')
    );
    fixture.detectChanges();
    await fixture.whenStable();

    // Action
    component.onHeaderBack();

    // Verify: The component uses ['./'] relative nav, effectively going up one level
    expect(router.navigate).toHaveBeenCalledWith(
      ['./'],
      expect.objectContaining({ relativeTo: expect.anything() })
    );
  });

  it('should navigate back to list when onHeaderBack called in chat mode', async () => {
    // Setup: Chat Mode
    currentUrl = '/chat/123';
    routerEvents$.next(new NavigationEnd(1, '/chat/123', '/chat/123'));
    fixture.detectChanges();
    await fixture.whenStable();

    component.onHeaderBack();
    expect(router.navigate).toHaveBeenCalledWith(['/messenger']);
  });
});
