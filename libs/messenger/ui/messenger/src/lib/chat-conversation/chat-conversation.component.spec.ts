import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatConversationComponent } from './chat-conversation.component';
import { ChatService } from '@nx-platform-application/messenger-state-chat-session';
import {
  MessageContentParser,
  ParsedMessage,
} from '@nx-platform-application/messenger-domain-message-content';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { URN } from '@nx-platform-application/platform-types';
import { AutoScrollDirective } from '@nx-platform-application/platform-ui-toolkit';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

// --- Mocks ---
const mockCurrentUserUrn = URN.parse('urn:contacts:user:me');
const mockRecipientUrn = URN.parse('urn:contacts:user:other');

const mockRawMessage: ChatMessage = {
  id: 'msg-1',
  conversationUrn: mockRecipientUrn,
  senderId: mockRecipientUrn,
  textContent: 'Hello',
  sentTimestamp: '2025-01-01T12:00:00.000Z',
  typeId: URN.parse('urn:message:type:text'),
  payloadBytes: new Uint8Array([1]),
};

const mockChatService = {
  messages: signal<ChatMessage[]>([]),
  currentUserUrn: signal<URN | null>(mockCurrentUserUrn),
  selectedConversation: signal<URN | null>(mockRecipientUrn),
  typingActivity: signal(new Map()),
  firstUnreadId: signal(null),
  isLoadingHistory: signal(false),
  sendMessage: vi.fn(),
  notifyTyping: vi.fn(),
};

const mockParser = {
  parse: vi.fn(),
};

const mockRouter = { navigate: vi.fn() };
const mockSnackBar = { open: vi.fn(), dismiss: vi.fn() };

describe('ChatConversationComponent', () => {
  let component: ChatConversationComponent;
  let fixture: ComponentFixture<ChatConversationComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockChatService.messages.set([mockRawMessage]);

    await TestBed.configureTestingModule({
      imports: [ChatConversationComponent, AutoScrollDirective],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: MessageContentParser, useValue: mockParser },
        { provide: Router, useValue: mockRouter },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatConversationComponent);
    component = fixture.componentInstance;
  });

  describe('View Model (messagesVM)', () => {
    it('should parse raw messages into Content Payloads', () => {
      mockParser.parse.mockReturnValue({
        kind: 'content',
        payload: { kind: 'text', text: 'Parsed Hello' },
      } as ParsedMessage);

      fixture.detectChanges();

      const vm = component.messagesVM();
      expect(vm.length).toBe(1);
      expect(vm[0].contentPayload).toEqual({
        kind: 'text',
        text: 'Parsed Hello',
      });
    });

    it('should HIDE Signal Payloads from the dumb UI', () => {
      mockParser.parse.mockReturnValue({
        kind: 'signal',
        payload: { action: 'read-receipt', data: null },
      } as ParsedMessage);

      fixture.detectChanges();

      const vm = component.messagesVM();
      expect(vm[0].contentPayload).toBeNull();
    });
  });

  describe('Interactions (Template & DOM)', () => {
    // RESTORED: Verifies (input) binding
    it('should notify typing on native input event', () => {
      fixture.detectChanges();
      const inputEl = fixture.debugElement.query(By.css('input')).nativeElement;

      inputEl.value = 'Typing...';
      inputEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(component.messageText()).toBe('Typing...');
      expect(mockChatService.notifyTyping).toHaveBeenCalled();
    });

    // RESTORED: Verifies (keydown.enter) binding
    it('should send message on Enter key', () => {
      fixture.detectChanges();

      // 1. Setup Input
      component.messageText.set('Enter Key Msg');
      fixture.detectChanges();

      // 2. Trigger Event
      const inputEl = fixture.debugElement.query(By.css('input'));
      inputEl.triggerEventHandler('keydown.enter', {});

      // 3. Verify Service Call
      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        mockRecipientUrn,
        'Enter Key Msg',
      );
      // 4. Verify Reset
      expect(component.messageText()).toBe('');
    });

    // RESTORED: Verifies (click) binding on the button
    it('should send message on Send button click', () => {
      fixture.detectChanges();

      component.messageText.set('Click Msg');
      fixture.detectChanges();

      const btn = fixture.debugElement.query(By.css('footer button'));
      btn.nativeElement.click();

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        mockRecipientUrn,
        'Click Msg',
      );
    });
  });

  describe('Actions (Logic)', () => {
    it('should navigate when onContentAction is triggered', () => {
      component.onContentAction('urn:contacts:user:bob');
      expect(mockRouter.navigate).toHaveBeenCalledWith([
        '/contacts/edit',
        'urn:contacts:user:bob',
      ]);
    });
  });
});
