import { ISODateTimeString } from '@nx-platform-application/platform-types';

/**
 * Represents the Summary/Index of a conversation.
 * Corresponds to the 'conversations' table.
 */
export interface ConversationIndexRecord {
  /** Primary Key: The URN of the contact or group */
  conversationUrn: string;
  name: string;

  lastActivityTimestamp: ISODateTimeString;
  snippet: string;
  unreadCount: number;

  genesisTimestamp: ISODateTimeString | null;

  lastModified: ISODateTimeString;
}
