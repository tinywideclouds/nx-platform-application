// libs/messenger/messenger-ui/src/lib/chat-conversation/chat-conversation.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatConversationComponent } from './chat-conversation.component';
import { ChatService } from '@nx-platform-application/chat-state';
import { signal, WritableSignal } from '@angular/core';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { URN } from '@nx-platform-application/platform-types';
import { FormsModule } from '@angular/forms';
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
      imports: [ChatConversationComponent, FormsModule],
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
    
    // First message (Other): White bg
    expect(bubbles[0].nativeElement.classList).toContain('bg-white');
    expect(bubbles[0].nativeElement.textContent).toContain('Hello');

    // Second message (Me): Blue bg
    expect(bubbles[1].nativeElement.classList).toContain('bg-blue-600');
    expect(bubbles[1].nativeElement.textContent).toContain('Hi there');
  });

  it('should send message on button click', async () => {
    // 1. Type message
    component.newMessageText = 'New Message';
    fixture.detectChanges();

    // 2. Click send
    const btn = fixture.debugElement.query(By.css('footer button'));
    btn.nativeElement.click();

    // 3. Verify
    expect(mockChatService.sendMessage).toHaveBeenCalledWith(mockRecipientUrn, 'New Message');
    expect(component.newMessageText).toBe(''); // Should clear
  });

  it('should send message on Enter key', () => {
    component.newMessageText = 'Enter Key Msg';
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('input'));
    input.triggerEventHandler('keydown.enter', {});

    expect(mockChatService.sendMessage).toHaveBeenCalledWith(mockRecipientUrn, 'Enter Key Msg');
  });

  it('should not send empty message', () => {
    component.newMessageText = '   ';
    fixture.detectChanges();

    const btn = fixture.debugElement.query(By.css('footer button'));
    btn.nativeElement.click();

    expect(mockChatService.sendMessage).not.toHaveBeenCalled();
  });
});