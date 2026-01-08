import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ConversationSyncState,
  ChatMessage,
} from '@nx-platform-application/messenger-types';

/**
 * CONTRACT: Write/Update operations for conversations.
 * Defined in Infrastructure. Consumed by Domain.
 */
export abstract class ConversationStorage {
  abstract markConversationAsRead(urn: URN): Promise<void>;

  abstract getConversationIndex(
    urn: URN,
  ): Promise<ConversationSyncState | undefined>;

  abstract getMessage(id: string): Promise<ChatMessage | undefined>;

  abstract updateMessageStatus(ids: string[], status: string): Promise<void>;

  abstract deleteMessage(id: string): Promise<void>;

  abstract clearMessageHistory(): Promise<void>;

  /**
   * MAINTENANCE: Removes deletion records older than a specific date.
   * Call this periodically (e.g., on app init) to prevent DB bloat.
   */
  abstract pruneTombstones(olderThan: ISODateTimeString): Promise<number>;
}
