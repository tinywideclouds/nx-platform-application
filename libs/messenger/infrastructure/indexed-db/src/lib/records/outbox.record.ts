import {
  DeliveryStatus,
  RecipientProgress,
} from '@nx-platform-application/messenger-types';

/**
 * Represents the flat DB record for an outbox task.
 * URNs are stored as strings.
 */
export interface OutboxRecord {
  id: string;
  messageId: string;
  conversationUrn: string; // Indexed
  parentMessageId?: string;
  typeId: string;
  payload: Uint8Array;
  tags: string[];

  // Stored as JSON-compatible array, URNs flattend to strings
  recipients: {
    urn: string;
    status: RecipientProgress['status'];
    error?: string;
    attempts: number;
    lastAttempt?: string;
  }[];

  status: DeliveryStatus; // Indexed
  createdAt: string;
}
