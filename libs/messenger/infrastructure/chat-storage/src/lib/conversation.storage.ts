import { URN } from '@nx-platform-application/platform-types';
import { ConversationSyncState } from '@nx-platform-application/messenger-types';

/**
 * CONTRACT: Write/Update operations for conversations.
 * Defined in Infrastructure. Consumed by Domain.
 */
export abstract class ConversationStorage {
  abstract markConversationAsRead(urn: URN): Promise<void>;

  abstract getConversationIndex(
    urn: URN,
  ): Promise<ConversationSyncState | undefined>;

  abstract updateMessageStatus(ids: string[], status: string): Promise<void>;

  abstract deleteMessage(id: string): Promise<void>;

  abstract clearMessageHistory(): Promise<void>;
}
