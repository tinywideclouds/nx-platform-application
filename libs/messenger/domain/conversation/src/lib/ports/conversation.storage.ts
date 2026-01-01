import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ConversationSyncState } from '@nx-platform-application/messenger-types';

/**
 * PORT: Write/Update operations for conversations.
 * Implemented by ChatStorageService (Infrastructure).
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
