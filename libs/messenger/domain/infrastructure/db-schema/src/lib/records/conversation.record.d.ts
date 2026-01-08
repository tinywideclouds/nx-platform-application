import { ISODateTimeString } from '@nx-platform-application/platform-types';
/**
 * Represents the Summary/Index of a conversation.
 * Corresponds to the 'conversations' table.
 */
export interface ConversationIndexRecord {
    /** Primary Key: The URN of the contact or group */
    conversationUrn: string;
    /** Sorting & UI (The "Inbox" View) */
    lastActivityTimestamp: ISODateTimeString;
    snippet: string;
    previewType: 'text' | 'image' | 'file' | 'other';
    unreadCount: number;
    /** GENESIS LOGIC (The "Scroll" Boundaries) */
    genesisTimestamp: ISODateTimeString | null;
    /** SYNC LOGIC (Optimistic Concurrency) */
    lastModified: ISODateTimeString;
}
