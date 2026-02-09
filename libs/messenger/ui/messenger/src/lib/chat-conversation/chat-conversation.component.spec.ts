import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatConversationComponent } from './chat-conversation.component';
import { ActiveChatFacade } from '@nx-platform-application/messenger-state-active-chat';
import { ChatDataService } from '@nx-platform-application/messenger-state-chat-data';
import { ChatMediaFacade } from '@nx-platform-application/messenger-state-media';
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { ConversationKind } from '@nx-platform-application/messenger-domain-conversation';
import { AutoScrollDirective } from '@nx-platform-application/platform-ui-toolkit';
import { signal } from '@angular/core';
import { vi, describe, it, beforeEach, expect, afterEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Temporal } from '@js-temporal/polyfill';

// --- Mocks ---
const mockCurrentUserUrn = URN.parse('urn:contacts:user:me');
const mockRecipientUrn = URN.parse('urn:contacts:user:other');
const mockGroupUrn = URN.parse('urn:messenger:group:alpha');

const mockRawMessage: ChatMessage = {
  id: 'msg-1',
  conversationUrn: mockRecipientUrn,
  senderId: mockRecipientUrn,
  snippet: 'Hello',
  sentTimestamp: '2025-01-01T12:00:00.000Z' as ISODateTimeString,
  typeId: URN.parse('urn:message:type:text'),
  payloadBytes: new Uint8Array([1]),
};

// Facade Mocks
const mockActiveChat = {
  messages: signal<ChatMessage[]>([mockRawMessage]),
  selectedConversation: signal<{ id: URN } | null>({ id: mockRecipientUrn }),
  isLoading: signal(false),
  firstUnreadId: signal(null),
  readCursors: signal(new Map()),
  // NEW: Mock Kind
  conversationKind: signal<ConversationKind | null>({
    type: 'direct',
    partnerId: mockRecipientUrn,
  }),
  sendTypingIndicator: vi.fn(),
  sendMessage: vi.fn(),
  recoverFailedMessage: vi.fn(),
  acceptGroupInvite: vi.fn(),
  rejectGroupInvite: vi.fn(),
};

const mockChatData = {
  typingActivity: signal(new Map()),
};

const mockMediaFacade = {
  sendImage: vi.fn(),
};

const mockIdentityFacade = {
  myUrn: signal(mockCurrentUserUrn),
};

const mockRouter = { navigate: vi.fn() };
const mockSnackBar = { open: vi.fn(), dismiss: vi.fn() };

describe('ChatConversationComponent', () => {
  let component: ChatConversationComponent;
  let fixture: ComponentFixture<ChatConversationComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ChatConversationComponent, AutoScrollDirective],
      providers: [
        { provide: ActiveChatFacade, useValue: mockActiveChat },
        { provide: ChatDataService, useValue: mockChatData },
        { provide: ChatMediaFacade, useValue: mockMediaFacade },
        { provide: ChatIdentityFacade, useValue: mockIdentityFacade },
        { provide: Router, useValue: mockRouter },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatConversationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Group Identification', () => {
    it('should identify Consensus Group as a group', () => {
      mockActiveChat.conversationKind.set({
        type: 'consensus',
        myStatus: 'joined',
      });
      fixture.detectChanges();
      expect(component.isGroupConversation()).toBe(true);
    });

    it('should identify Broadcast List as a group', () => {
      mockActiveChat.conversationKind.set({
        type: 'broadcast',
        recipients: [],
      });
      fixture.detectChanges();
      expect(component.isGroupConversation()).toBe(true);
    });

    it('should NOT identify Direct chat as a group', () => {
      mockActiveChat.conversationKind.set({
        type: 'direct',
        partnerId: mockRecipientUrn,
      });
      fixture.detectChanges();
      expect(component.isGroupConversation()).toBe(false);
    });
  });

  describe('Typing Indicators (Display)', () => {
    it('should show indicator when active in CURRENT conversation', () => {
      // 1. Setup: Selected Conversation = Recipient
      mockActiveChat.selectedConversation.set({ id: mockRecipientUrn });

      // 2. Setup: Activity in that conversation
      const now = Temporal.Now.instant();
      const recent = now.subtract({ seconds: 2 });

      const convMap = new Map();
      convMap.set(mockRecipientUrn.toString(), recent);

      const globalMap = new Map();
      globalMap.set(mockRecipientUrn.toString(), convMap);

      mockChatData.typingActivity.set(globalMap);
      fixture.detectChanges();

      expect(component.showTypingIndicator()).toBe(true);
    });

    it('should NOT show indicator if activity is in DIFFERENT conversation', () => {
      // 1. Setup: Selected Conversation = Recipient
      mockActiveChat.selectedConversation.set({ id: mockRecipientUrn });

      // 2. Setup: Activity in GROUP
      const now = Temporal.Now.instant();
      const recent = now.subtract({ seconds: 2 });

      const convMap = new Map();
      convMap.set('some-user', recent);

      const globalMap = new Map();
      // Key is Group URN, not current Recipient URN
      globalMap.set(mockGroupUrn.toString(), convMap);

      mockChatData.typingActivity.set(globalMap);
      fixture.detectChanges();

      expect(component.showTypingIndicator()).toBe(false);
    });
  });

  describe('Typing Indicators (Throttling)', () => {
    it('should throttle outgoing typing indicators (3s)', () => {
      component.onTyping();
      expect(mockActiveChat.sendTypingIndicator).toHaveBeenCalledTimes(1);

      component.onTyping();
      vi.advanceTimersByTime(2000);
      expect(mockActiveChat.sendTypingIndicator).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1100);
      component.onTyping();
      expect(mockActiveChat.sendTypingIndicator).toHaveBeenCalledTimes(2);
    });
  });
});
