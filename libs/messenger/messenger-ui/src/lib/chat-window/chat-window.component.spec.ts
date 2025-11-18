// libs/messenger/messenger-ui/src/lib/chat-shell/chat-shell.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatShellComponent } from './chat-window.component';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject, of } from 'rxjs';
import { signal } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { vi } from 'vitest';

// Services
import { ChatService } from '@nx-platform-application/chat-state';
import { ContactsStorageService, Contact, ContactGroup } from '@nx-platform-application/contacts-data-access';
import { Logger } from '@nx-platform-application/console-logger';

// Child Mocks
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ChatWindowHeaderComponent } from '../chat-window-header/chat-window-header.component';

@Component({
  selector: 'messenger-chat-window-header',
  standalone: true,
  template: '<div>Header</div>'
})
class MockHeaderComponent {
  @Input() participant: any;
  @Input() mode: any;
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
  serviceContacts: { messenger: { profilePictureUrl: 'img.png' } } as any
};

// Service Mocks
const mockChatService = {
  loadConversation: vi.fn(),
  selectedConversation: signal(null),
  currentUserUrn: signal(null),
  messages: signal([]),
};

const mockContactsService = {
  contacts$: of([mockContact]),
  groups$: of([]),
};

const mockLogger = { error: vi.fn() };

describe('ChatShellComponent', () => {
  let component: ChatShellComponent;
  let fixture: ComponentFixture<ChatShellComponent>;
  let router: Router;
  let routerEvents$: Subject<any>;
  let routeParamMap$: Subject<any>;

  beforeEach(async () => {
    routerEvents$ = new Subject();
    routeParamMap$ = new Subject();

    await TestBed.configureTestingModule({
      imports: [ChatShellComponent, RouterTestingModule],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: Logger, useValue: mockLogger },
        { 
          provide: ActivatedRoute, 
          useValue: { paramMap: routeParamMap$, snapshot: {} } 
        }
      ]
    })
    .overrideComponent(ChatShellComponent, {
      remove: { imports: [ChatWindowHeaderComponent] },
      add: { imports: [MockHeaderComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatShellComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    
    // Spy on router.events by overriding the property 
    // (RouterTestingModule makes this tricky, but we can mock the property on the instance)
    Object.defineProperty(router, 'events', { value: routerEvents$ });
    // We also need to mock router.url because the signal reads it
    Object.defineProperty(router, 'url', { value: '/chat/123', writable: true });
    
    vi.spyOn(router, 'navigate');

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load conversation when route ID changes', async () => {
    routeParamMap$.next({ get: () => mockContactUrn.toString() });
    fixture.detectChanges();
    // await stable for effect?
    await fixture.whenStable();
    
    expect(mockChatService.loadConversation).toHaveBeenCalledWith(mockContactUrn);
  });

  it('should calculate participant correctly', () => {
    routeParamMap$.next({ get: () => mockContactUrn.toString() });
    fixture.detectChanges();
    
    const participant = component.participant();
    expect(participant).toBeTruthy();
    expect(participant?.name).toBe('Alice');
    expect(participant?.profilePictureUrl).toBe('img.png');
  });

  it('should detect "details" view mode from router', () => {
    // Simulate navigation event
    Object.defineProperty(router, 'url', { value: '/chat/123/details' });
    routerEvents$.next(new NavigationEnd(1, '/chat/123/details', '/chat/123/details'));
    
    fixture.detectChanges();
    expect(component.viewMode()).toBe('details');
  });

  it('should detect "chat" view mode from router', () => {
    Object.defineProperty(router, 'url', { value: '/chat/123' });
    routerEvents$.next(new NavigationEnd(1, '/chat/123', '/chat/123'));
    
    fixture.detectChanges();
    expect(component.viewMode()).toBe('chat');
  });

  it('should navigate UP when onHeaderBack called in details mode', () => {
    // Force details mode
    Object.defineProperty(router, 'url', { value: '/chat/123/details' });
    routerEvents$.next(new NavigationEnd(1, '/chat/123/details', '/chat/123/details'));
    fixture.detectChanges();

    component.onHeaderBack();
    expect(router.navigate).toHaveBeenCalledWith(['../'], expect.anything());
  });

  it('should navigate back to list when onHeaderBack called in chat mode', () => {
    Object.defineProperty(router, 'url', { value: '/chat/123' });
    routerEvents$.next(new NavigationEnd(1, '/chat/123', '/chat/123'));
    fixture.detectChanges();

    component.onHeaderBack();
    expect(router.navigate).toHaveBeenCalledWith(['/messenger']);
  });

  it('should navigate to CHAT (./) when onHeaderBack called in details mode', () => {
    // Force details mode
    Object.defineProperty(router, 'url', { value: '/chat/123/details' });
    routerEvents$.next(new NavigationEnd(1, '/chat/123/details', '/chat/123/details'));
    fixture.detectChanges();

    component.onHeaderBack();
    // FIX: Expect navigation to ./ relative to current route
    expect(router.navigate).toHaveBeenCalledWith(['./'], expect.objectContaining({ relativeTo: expect.anything() }));
  });

  it('should navigate to CHAT (./) when toggling info from details mode', () => {
    Object.defineProperty(router, 'url', { value: '/chat/123/details' });
    routerEvents$.next(new NavigationEnd(1, '/chat/123/details', '/chat/123/details'));
    fixture.detectChanges();

    component.onToggleInfo();
    // FIX: Expect navigation to ./
    expect(router.navigate).toHaveBeenCalledWith(['./'], expect.objectContaining({ relativeTo: expect.anything() }));
  });
});