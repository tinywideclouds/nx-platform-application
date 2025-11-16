import { Injectable, signal } from '@angular/core';
import { URN, ISODateTimeString } from '@nx-platform-application/platform-types';
import { ConversationSummary } from '@nx-platform-application/chat-storage';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { computed } from '@angular/core';

// --- Mock Data ---

// 1. Define the mock users
const MOCK_USER = URN.parse('urn:sm:user:me');
const MOCK_CONTACT_1 = URN.parse('urn:sm:user:mock-contact-1'); // Alice
const MOCK_CONTACT_2 = URN.parse('urn:sm:user:mock-contact-2'); // Bob
const MOCK_GROUP_1 = URN.parse('urn:sm:group:mock-group-1'); // Dev Team

// 2. Create Mock Conversations
const MOCK_CONVOS: ConversationSummary[] = [
  {
    conversationUrn: MOCK_CONTACT_1,
    latestSnippet: 'Hey, are you free for the meeting?',
    timestamp: new Date('2025-11-16T14:30:00Z').toISOString() as ISODateTimeString,
    unreadCount: 2,
  },
  {
    conversationUrn: MOCK_CONTACT_2,
    latestSnippet: 'You: Sounds good, see you then.',
    timestamp: new Date('2025-11-15T10:15:00Z').toISOString() as ISODateTimeString,
    unreadCount: 0,
  },
  {
    conversationUrn: MOCK_GROUP_1,
    latestSnippet: 'Bob: Can someone review my PR?',
    timestamp: new Date('2025-11-16T13:00:00Z').toISOString() as ISODateTimeString,
    unreadCount: 1,
  },
];

// 3. Create a map of mock messages for each conversation
const MOCK_MESSAGES_DB = new Map<string, ChatMessage[]>([
  // Conversation with Alice
  [
    MOCK_CONTACT_1.toString(),
    [
      {
        id: 'msg-a-1',
        conversationUrn: MOCK_CONTACT_1,
        senderId: MOCK_CONTACT_1,
        timestamp: new Date('2025-11-16T14:29:00Z'),
        textContent: 'Hey, are you free for the meeting?',
        type: 'text',
      },
      {
        id: 'msg-a-2',
        conversationUrn: MOCK_CONTACT_1,
        senderId: MOCK_CONTACT_1,
        timestamp: new Date('2025-11-16T14:30:00Z'),
        textContent: 'It\'s about the new deployment.',
        type: 'text',
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
        timestamp: new Date('2025-11-15T10:14:00Z'),
        textContent: 'Project update is ready for review.',
        type: 'text',
      },
      {
        id: 'msg-b-2',
        conversationUrn: MOCK_CONTACT_2,
        senderId: MOCK_USER,
        timestamp: new Date('2025-11-15T10:15:00Z'),
        textContent: 'Sounds good, see you then.',
        type: 'text',
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
        timestamp: new Date('2025-11-16T13:00:00Z'),
        textContent: 'Can someone review my PR?',
        type: 'text',
      },
    ],
  ],
]);

/**
 * Provides a mock implementation of the ChatService.
 * This service is provided in app.config.ts when environment.useMocks is true.
 * It simulates the full UI state for conversations and messages.
 */
@Injectable()
export class MockChatService {
  // --- Public API (Signals) ---

  /** Provides a static list of mock conversations. */
  public readonly activeConversations = signal(MOCK_CONVOS);

  /** Holds the URN of the currently selected conversation. */
  public readonly selectedConversation = signal<URN | null>(null);

  /** The current mock user's URN. */
  public readonly currentUserUrn = signal(MOCK_USER);

  /**
   * A computed signal that returns the correct message history
   * based on the currently selectedConversation.
   */
  public readonly messages = computed(() => {
    const selectedId = this.selectedConversation()?.toString();
    if (!selectedId) {
      return []; // No conversation selected
    }
    return MOCK_MESSAGES_DB.get(selectedId) || []; // Return history or empty array
  });

  // --- Public API (Mock Methods) ---

  /** Simulates loading a conversation. */
  loadConversation(urn: URN | null): Promise<void> {
    if (this.selectedConversation()?.toString() === urn?.toString()) {
      console.log(`[MockChatService] Conversation ${urn?.toString()} already selected.`);
      return Promise.resolve(); 
    }
    console.log('[MockChatService] Loading conversation:', urn?.toString());
    // In the mock, we just update the signal.
    // The `messages` computed signal will react automatically.
    this.selectedConversation.set(urn);
    
    // Mark messages as "read"
    if (urn) {
      const convo = this.activeConversations().find(c => c.conversationUrn.toString() === urn.toString());
      if (convo) {
        convo.unreadCount = 0;
        this.activeConversations.set([...this.activeConversations()]);
      }
    }
    return Promise.resolve();
  }

  /** Simulates sending a new message. */
  sendMessage(recipientUrn: URN, plaintext: string): Promise<void> {
    console.log(
      `[MockChatService] Sending message to ${recipientUrn.toString()}: ${plaintext}`
    );

    const recipientId = recipientUrn.toString();
    
    // 1. Create the new mock message
    const newMessage: ChatMessage = {
      id: `mock-msg-${crypto.randomUUID()}`,
      conversationUrn: recipientUrn,
      senderId: MOCK_USER, // From "me"
      timestamp: new Date(),
      textContent: plaintext,
      type: 'text',
    };

    // 2. Get the current history for this convo
    const currentHistory = MOCK_MESSAGES_DB.get(recipientId) || [];
    
    // 3. Add the new message to the mock DB
    MOCK_MESSAGES_DB.set(recipientId, [...currentHistory, newMessage]);

    // 4. Update the `messages` signal by re-triggering the `selectedConversation`
    // This forces the `computed` signal to re-evaluate.
    this.selectedConversation.set(null); // Deselect
    this.selectedConversation.set(recipientUrn); // Reselect
    
    // 5. Update the conversation summary
    const convo = this.activeConversations().find(c => c.conversationUrn.toString() === recipientId);
    if (convo) {
      convo.latestSnippet = `You: ${plaintext}`;
      convo.timestamp = newMessage.timestamp.toISOString() as ISODateTimeString;
      this.activeConversations.set([...this.activeConversations()]);
    }

    return Promise.resolve();
  }
}