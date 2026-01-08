import { ISODateTimeString } from '@nx-platform-application/platform-types';
/**
 * Represents a deleted message reference.
 * Used for syncing deletions to the cloud.
 */
export interface DeletedMessageRecord {
    messageId: string;
    conversationUrn: string;
    deletedAt: ISODateTimeString;
}
