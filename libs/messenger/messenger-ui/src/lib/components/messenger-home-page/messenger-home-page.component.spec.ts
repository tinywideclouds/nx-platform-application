import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { MessengerHomePageComponent } from './messenger-home-page.component';

// --- Mocks ---
import { ChatService } from '@nx-platform-application/chat-state';
import { ContactsStorageService } from '@nx-platform-application/contacts-data-access';
import { ConversationSummary } from '@nx-platform-application/chat-storage';
import { URN } from '@nx-platform-application/platform-types';

// --- Mock Implementations ---
const mockChatService = {
  activeConversations: signal([] as ConversationSummary[]),
  selectedConversation: signal(null as URN | null),
  loadConversation: vi.fn(),
};

const mockContactsService = {
  contacts$: of([]),
  groups$: of([]),
};

describe('MessengerHomePageComponent', () => {
  let component: MessengerHomePageComponent;
  let fixture: ComponentFixture<MessengerHomePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MessengerHomePageComponent,
        RouterTestingModule, // Import for RouterOutlet/RouterLink
      ],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: ContactsStorageService, useValue: mockContactsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerHomePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // We will add more tests here later to check the viewMode logic
});