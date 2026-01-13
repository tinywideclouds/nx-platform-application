// apps/messenger/messenger-app/src/app/mocks/mock-chat.service.ts

import { Injectable, signal, inject } from '@angular/core';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  ConversationSummary,
} from '@nx-platform-application/messenger-types';
import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';
import { computed } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';

// --- Mock Data ---

const MOCK_USER = URN.parse('urn:contacts:user:me');
const MOCK_CONTACT_1 = URN.parse('urn:contacts:user:mock-contact-1'); // Alice
const MOCK_CONTACT_2 = URN.parse('urn:contacts:user:mock-contact-2'); // Bob
const MOCK_GROUP_1 = URN.parse('urn:contacts:group:mock-group-1'); // Dev Team

const MOCK_CONVOS: ConversationSummary[] = [
  {
    conversationUrn: MOCK_CONTACT_1,
    latestSnippet: 'Hey, are you free for the meeting?',
    timestamp: Temporal.Instant.from(
      '2025-11-16T14:30:00Z',
    ).toString() as ISODateTimeString,
    unreadCount: 2,
    previewType: 'text', // ✅ FIXED
  },
  {
    conversationUrn: MOCK_CONTACT_2,
    latestSnippet: 'You: Sounds good, see you then.',
    timestamp: Temporal.Instant.from(
      '2025-11-15T10:15:00Z',
    ).toString() as ISODateTimeString,
    unreadCount: 0,
    previewType: 'text', // ✅ FIXED
  },
  {
    conversationUrn: MOCK_GROUP_1,
    latestSnippet: 'Bob: Can someone review my PR?',
    timestamp: Temporal.Instant.from(
      '2025-11-16T13:00:00Z',
    ).toString() as ISODateTimeString,
    unreadCount: 1,
    previewType: 'text', // ✅ FIXED
  },
];

const textType = MessageTypeText;

const MOCK_MESSAGES_DB = new Map<string, ChatMessage[]>([
  // ... (Existing messages logic unchanged) ...
  // Conversation with Alice
  [
    MOCK_CONTACT_1.toString(),
    [
      {
        id: 'msg-a-1',
        conversationUrn: MOCK_CONTACT_1,
        senderId: MOCK_CONTACT_1,
        sentTimestamp: Temporal.Instant.from(
          '2025-11-16T14:29:00Z',
        ).toString() as ISODateTimeString,
        textContent: 'Hey, are you free for the meeting?',
        typeId: textType,
      },
      {
        id: 'msg-a-2',
        conversationUrn: MOCK_CONTACT_1,
        senderId: MOCK_CONTACT_1,
        sentTimestamp: Temporal.Instant.from(
          '2025-11-16T14:30:00Z',
        ).toString() as ISODateTimeString,
        textContent: "It's about the new deployment.",
        typeId: textType,
      },
    ],
  ],
  // Conversation with Bob
  [
    MOCK_CONTACT_2.toString(),
    [
      {
        id: 'msg-b-1',
        conversationUrn: MOCK_CONTACT_2,
        senderId: MOCK_CONTACT_2,
        sentTimestamp: Temporal.Instant.from(
          '2025-11-15T10:14:00Z',
        ).toString() as ISODateTimeString,
        textContent: 'Project update is ready for review.',
        typeId: textType,
      },
      {
        id: 'msg-b-2',
        conversationUrn: MOCK_CONTACT_2,
        senderId: MOCK_USER,
        sentTimestamp: Temporal.Instant.from(
          '2025-11-15T10:15:00Z',
        ).toString() as ISODateTimeString,
        textContent: 'Sounds good, see you then.',
        typeId: textType,
      },
    ],
  ],
  // Conversation with Dev Team
  [
    MOCK_GROUP_1.toString(),
    [
      {
        id: 'msg-g-1',
        conversationUrn: MOCK_GROUP_1,
        senderId: MOCK_CONTACT_2, // Bob
        sentTimestamp: Temporal.Instant.from(
          '2025-11-16T13:00:00Z',
        ).toString() as ISODateTimeString,
        textContent: 'Can someone review my PR?',
        typeId: textType,
      },
    ],
  ],
]);

@Injectable()
export class MockChatService {
  private authService = inject(IAuthService);

  public readonly activeConversations = signal(MOCK_CONVOS);
  public readonly selectedConversation = signal<URN | null>(null);
  public readonly currentUserUrn = signal(MOCK_USER);
  public readonly isRecipientKeyMissing = signal<boolean>(false);

  public readonly messages = computed(() => {
    const selectedId = this.selectedConversation()?.toString();
    if (!selectedId) {
      return [];
    }
    return MOCK_MESSAGES_DB.get(selectedId) || [];
  });

  loadConversation(urn: URN | null): Promise<void> {
    if (this.selectedConversation()?.toString() === urn?.toString()) {
      return Promise.resolve();
    }
    this.selectedConversation.set(urn);
    this.isRecipientKeyMissing.set(false);

    if (urn) {
      const urnString = urn.toString();
      const exists = this.activeConversations().some(
        (c) => c.conversationUrn.toString() === urnString,
      );
      if (!exists) {
        this.activeConversations.update((list) => [
          {
            conversationUrn: urn,
            latestSnippet: '',
            timestamp: Temporal.Now.instant().toString() as ISODateTimeString,
            unreadCount: 0,
            previewType: 'text', // ✅ FIXED: Default for new mock chats
          },
          ...list,
        ]);
      }
    }

    return Promise.resolve();
  }

  sendMessage(recipientUrn: URN, plaintext: string): Promise<void> {
    console.log(
      `[MockChatService] Sending message to ${recipientUrn.toString()}: ${plaintext}`,
    );

    const recipientId = recipientUrn.toString();
    const newMessage: ChatMessage = {
      id: `mock-msg-${crypto.randomUUID()}`,
      conversationUrn: recipientUrn,
      senderId: MOCK_USER,
      sentTimestamp: Temporal.Now.instant().toString() as ISODateTimeString,
      textContent: plaintext,
      typeId: textType,
    };

    const currentHistory = MOCK_MESSAGES_DB.get(recipientId) || [];
    MOCK_MESSAGES_DB.set(recipientId, [...currentHistory, newMessage]);

    this.selectedConversation.set(null);
    this.selectedConversation.set(recipientUrn);

    const convo = this.activeConversations().find(
      (c) => c.conversationUrn.toString() === recipientId,
    );
    if (convo) {
      convo.latestSnippet = `You: ${plaintext}`;
      convo.timestamp = newMessage.sentTimestamp;
      convo.previewType = 'text'; // ✅ FIXED
      this.activeConversations.set([...this.activeConversations()]);
    }

    return Promise.resolve();
  }

  logout(): Promise<void> {
    console.log('[MockChatService] Logging out... Wiping mock state.');
    this.activeConversations.set([]);
    this.selectedConversation.set(null);
    this.isRecipientKeyMissing.set(false);
    this.authService.logout();
    return Promise.resolve();
  }
}
