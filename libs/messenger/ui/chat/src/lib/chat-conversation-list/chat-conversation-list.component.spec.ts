// libs/messenger/chat-ui/src/lib/chat-conversation-list/chat-conversation-list.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
// --- 1. Import URN ---
import { URN } from '@nx-platform-application/platform-types';

// Import the new View Model
import {
  ChatConversationListComponent,
  ConversationViewItem,
} from './chat-conversation-list.component';
import { ChatConversationListItemComponent } from '../chat-conversation-list-item/chat-conversation-list-item.component';
import { ContactAvatarComponent } from '@nx-platform-application/contacts-ui';

// --- 2. Update Mock Fixture to use URN objects ---
const MOCK_ITEMS: ConversationViewItem[] = [
  {
    id: URN.parse('urn:contacts:user:contact-123'),
    name: 'johndoe',
    latestMessage: 'Hey',
    timestamp: '2025-11-15T12:30:00Z',
    initials: 'JD',
    unreadCount: 2,
    isActive: false,
  },
  {
    id: URN.parse('urn:contacts:user:contact-456'),
    name: 'janedoe',
    latestMessage: 'Hi',
    timestamp: '2025-11-15T12:31:00Z',
    initials: 'JD',
    unreadCount: 0,
    isActive: true,
  },
];

// --- Mock Host Component (Updated) ---
@Component({
  standalone: true,
  imports: [ChatConversationListComponent],
  template: `
    <chat-conversation-list
      [items]="conversations"
      (conversationSelected)="onSelected($event)"
    />
  `,
})
class TestHostComponent {
  conversations: ConversationViewItem[] = [];
  // --- 3. Update the type to URN ---
  selectedId?: URN;
  onSelected(id: URN) {
    this.selectedId = id;
  }
}

describe('ChatConversationListComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TestHostComponent,
        ChatConversationListComponent,
        ChatConversationListItemComponent,
        ContactAvatarComponent, // Dependency
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
  });

  it('should render the correct number of list items', () => {
    hostComponent.conversations = MOCK_ITEMS;
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(
      By.css('chat-conversation-list-item'),
    );
    expect(items.length).toBe(MOCK_ITEMS.length);
  });

  // --- 4. Update the assertion to check for the URN object ---
  it('should emit the ID when a child item emits (select)', () => {
    hostComponent.conversations = MOCK_ITEMS;
    fixture.detectChanges();

    const firstItemEl = fixture.debugElement.query(
      By.css('chat-conversation-list-item'),
    );

    // Trigger the child's output event
    firstItemEl.triggerEventHandler('select');
    fixture.detectChanges();

    // Assert that the host's handler was called with the URN object
    expect(hostComponent.selectedId).toBe(MOCK_ITEMS[0].id);
    expect(hostComponent.selectedId).toBeInstanceOf(URN);
  });

  it('should display an empty message when no conversations are provided', () => {
    hostComponent.conversations = [];
    fixture.detectChanges();

    const emptyMessage = fixture.debugElement.query(
      By.css('[data-testid="empty-conversation-list"]'),
    );
    expect(emptyMessage).toBeTruthy();
    expect(emptyMessage.nativeElement.textContent).toContain(
      'No conversations',
    );
  });
});
