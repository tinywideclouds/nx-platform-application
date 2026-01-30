// libs/messenger/infrastructure/chat-storage/src/lib/history.reader.ts

import { URN } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  Conversation,
  MessageTombstone, // ✅ Added import
} from '@nx-platform-application/messenger-types';

export interface HistoryQuery {
  conversationUrn: URN;
  limit: number;
  beforeTimestamp?: string;
}

export interface HistoryResult {
  messages: ChatMessage[];
  genesisReached: boolean;
}

/**
 * CONTRACT: Read-only access to the Chat Database.
 * Consumed by:
 * 1. UI Domain (Inbox, Chat View)
 * 2. Sync Domain (Cloud Backup/Restore)
 */
export abstract class HistoryReader {
  // --- UI Queries ---

  abstract getMessages(query: HistoryQuery): Promise<HistoryResult>;

  abstract getAllConversations(): Promise<Conversation[]>;

  // --- Sync / Range Queries (Added to protect them from pruning) ---

  /**
   * Returns all messages within a strict time window (inclusive).
   * Used by Cloud Sync to grab daily/weekly chunks.
   */
  abstract getMessagesInRange(
    start: string,
    end: string,
  ): Promise<ChatMessage[]>;

  /**
   * Returns all deletion markers within a strict time window.
   * Used by Cloud Sync to propagate deletions.
   */
  abstract getTombstonesInRange(
    start: string,
    end: string,
  ): Promise<MessageTombstone[]>;
}
