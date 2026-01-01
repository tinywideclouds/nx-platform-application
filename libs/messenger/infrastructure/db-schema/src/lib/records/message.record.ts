import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { MessageDeliveryStatus } from '@nx-platform-application/messenger-types';

/**
 * Represents a stored Chat Message.
 * Corresponds to the 'messages' table.
 */
export interface MessageRecord {
  messageId: string; // PK
  senderId: string;
  recipientId: string;
  conversationUrn: string; // FK to Conversation Index
  sentTimestamp: ISODateTimeString;
  typeId: string;
  payloadBytes: Uint8Array;
  status: MessageDeliveryStatus;
  tags?: string[]; // Stored as array of strings for MultiEntry Index
}
