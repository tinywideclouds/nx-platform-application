// libs/messenger/chat-ui/src/lib/chat-conversation-list/chat-conversation-list.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';

// Import the new View Model
import {
  ChatConversationListComponent,
  ConversationViewItem,
} from './chat-conversation-list.component';
import { ChatConversationListItemComponent } from '../chat-conversation-list-item/chat-conversation-list-item.component';
import { ContactAvatarComponent } from '@nx-platform-application/contacts-ui';

// --- New Mock Fixture ---
const MOCK_ITEMS: ConversationViewItem[] = [
  {
    id: 'urn:sm:user:contact-123',
    name: 'johndoe',
    latestMessage: 'Hey',
    timestamp: '2025-11-15T12:30:00Z',
    initials: 'JD',
    unreadCount: 2,
    isActive: false,
  },
  {
    id: 'urn:sm:user:contact-456',
    name: 'janedoe',
    latestMessage: 'Hi',
    timestamp: '2025-11-15T12:31:00Z',
    initials: 'JD',
    unreadCount: 0,
    isActive: true, // Test this property
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
  selectedId?: string;
  onSelected(id: string) {
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
      By.css('chat-conversation-list-item')
    );
    expect(items.length).toBe(MOCK_ITEMS.length);
  });

  it('should emit the ID when a child item emits (select)', () => {
    hostComponent.conversations = MOCK_ITEMS;
    fixture.detectChanges();

    const firstItemEl = fixture.debugElement.query(
      By.css('chat-conversation-list-item')
    );

    // Trigger the child's output event
    firstItemEl.triggerEventHandler('select');
    fixture.detectChanges();

    // Assert that the host's handler was called with the ID
    expect(hostComponent.selectedId).toBe(MOCK_ITEMS[0].id);
  });

  it('should display an empty message when no conversations are provided', () => {
    hostComponent.conversations = [];
    fixture.detectChanges();

    const emptyMessage = fixture.debugElement.query(
      By.css('[data-testid="empty-conversation-list"]')
    );
    expect(emptyMessage).toBeTruthy();
    expect(emptyMessage.nativeElement.textContent).toContain('No conversations');
  });
});