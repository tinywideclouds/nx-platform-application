// libs/messenger/messenger-ui/src/lib/chat-conversation/chat-conversation.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatConversationComponent } from './chat-conversation.component';
import { ChatService } from '@nx-platform-application/chat-state';
import { signal } from '@angular/core';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { URN } from '@nx-platform-application/platform-types';
import { ReactiveFormsModule } from '@angular/forms'; // Changed from FormsModule
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

// --- Mocks ---
const mockCurrentUserUrn = URN.parse('urn:sm:user:me');
const mockRecipientUrn = URN.parse('urn:sm:user:other');

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    conversationUrn: mockRecipientUrn,
    senderId: mockRecipientUrn,
    textContent: 'Hello',
    timestamp: new Date(),
    type: 'text'
  },
  {
    id: '2',
    conversationUrn: mockRecipientUrn,
    senderId: mockCurrentUserUrn,
    textContent: 'Hi there',
    timestamp: new Date(),
    type: 'text'
  }
];

const mockChatService = {
  messages: signal<ChatMessage[]>([]),
  currentUserUrn: signal<URN | null>(mockCurrentUserUrn),
  selectedConversation: signal<URN | null>(mockRecipientUrn),
  sendMessage: vi.fn(),
};

describe('ChatConversationComponent', () => {
  let component: ChatConversationComponent;
  let fixture: ComponentFixture<ChatConversationComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockChatService.messages.set(mockMessages);

    await TestBed.configureTestingModule({
      imports: [ChatConversationComponent, ReactiveFormsModule], // Updated import
      providers: [
        { provide: ChatService, useValue: mockChatService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChatConversationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render messages with correct styling for sender/receiver', () => {
    const bubbles = fixture.debugElement.queryAll(By.css('.max-w-xs'));
    expect(bubbles.length).toBe(2);
    expect(bubbles[0].nativeElement.classList).toContain('bg-white'); // Receiver
    expect(bubbles[1].nativeElement.classList).toContain('bg-blue-600'); // Sender
  });

  it('should send message on button click', () => {
    // 1. Set value via FormControl
    component.messageControl.setValue('New Message');
    fixture.detectChanges();

    // 2. Click send
    const btn = fixture.debugElement.query(By.css('footer button'));
    btn.nativeElement.click();

    // 3. Verify
    expect(mockChatService.sendMessage).toHaveBeenCalledWith(mockRecipientUrn, 'New Message');
    expect(component.messageControl.value).toBe(''); // Should reset
  });

  it('should send message on Enter key', () => {
    component.messageControl.setValue('Enter Key Msg');
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('input'));
    input.triggerEventHandler('keydown.enter', {});

    expect(mockChatService.sendMessage).toHaveBeenCalledWith(mockRecipientUrn, 'Enter Key Msg');
  });

  it('should not send empty message', () => {
    component.messageControl.setValue('   ');
    fixture.detectChanges();

    const btn = fixture.debugElement.query(By.css('footer button'));
    btn.nativeElement.click();

    expect(mockChatService.sendMessage).not.toHaveBeenCalled();
  });
});