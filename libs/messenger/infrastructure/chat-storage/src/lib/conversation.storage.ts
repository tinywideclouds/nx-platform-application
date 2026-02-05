import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  Conversation,
  ChatMessage,
  MessageDeliveryStatus, // Added strict type
} from '@nx-platform-application/messenger-types';

/**
 * CONTRACT: Persistence operations for conversations and messages.
 * Defined in Infrastructure. Consumed by Domain.
 */
export abstract class ConversationStorage {
  // --- IDENTITY & LIFECYCLE ---

  /**
   * Initializes a conversation if it doesn't exist, or updates the name.
   * Preserves existing history/state (safe init).
   */
  abstract startConversation(urn: URN, name: string): Promise<void>;

  abstract renameConversation(urn: URN, name: string): Promise<void>;

  abstract conversationExists(urn: URN): Promise<boolean>;

  // --- RETRIEVAL ---

  /**
   * Refactor: Renamed from getConversationIndex.
   * Returns the single unified Conversation object.
   */
  abstract getConversation(urn: URN): Promise<Conversation | undefined>;

  // --- PERSISTENCE ---

  /**
   * Refactor: Renamed from bulkUploadConversationSummaries.
   * Persists a batch of conversations (e.g., from a sync or import).
   */
  abstract bulkSaveConversations(conversations: Conversation[]): Promise<void>;

  // --- STATUS & MESSAGES ---

  abstract markConversationAsRead(urn: URN): Promise<void>;

  // this is for local updates of incoming message use updateMessageStatus for network driven updates of sent messages
  // use updateMessageStatus
  abstract markMessagesAsRead(
    conversationUrn: URN,
    messageIds: string[],
  ): Promise<void>;

  abstract getMessage(id: string): Promise<ChatMessage | undefined>;

  abstract updateMessageStatus(
    ids: string[],
    status: MessageDeliveryStatus,
  ): Promise<void>;

  abstract deleteMessage(id: string): Promise<void>;

  abstract clearMessageHistory(): Promise<void>;

  /**
   * MAINTENANCE: Removes deletion records older than a specific date.
   */
  abstract pruneTombstones(olderThan: ISODateTimeString): Promise<number>;
}
