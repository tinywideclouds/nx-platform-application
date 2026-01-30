import { ISODateTimeString } from '@nx-platform-application/platform-types';

/**
 * Represents a deleted message reference.
 * Used for syncing deletions to the cloud.
 */
export interface DeletedMessageRecord {
  messageId: string; // PK
  conversationUrn: string;
  deletedAt: ISODateTimeString; // Indexed for range queries
}
