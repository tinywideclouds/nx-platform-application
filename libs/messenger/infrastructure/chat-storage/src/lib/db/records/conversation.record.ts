import { ISODateTimeString } from '@nx-platform-application/platform-types';

/**
 * Represents the Summary/Index of a conversation.
 * Corresponds to the 'conversations' table.
 */
export interface ConversationIndexRecord {
  /** Primary Key: The URN of the contact or group */
  conversationUrn: string;

  /** Sorting & UI (The "Inbox" View) */
  lastActivityTimestamp: ISODateTimeString; // ISO String, indexed for fast sorting
  snippet: string; // Decrypted text preview
  previewType: 'text' | 'image' | 'file' | 'other';
  unreadCount: number;

  /** GENESIS LOGIC (The "Scroll" Boundaries) */
  // If set, we know history definitely starts here. Stop scrolling.
  genesisTimestamp: ISODateTimeString | null;

  /** SYNC LOGIC (Optimistic Concurrency) */
  lastModified: ISODateTimeString;
}
