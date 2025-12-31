// libs/messenger/chat-storage/src/lib/chat-storage.models.ts

import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { MessageDeliveryStatus } from '@nx-platform-application/messenger-types';

// --- STORAGE MODELS (Dexie) ---

export interface DeletedMessageRecord {
  messageId: string; // PK
  conversationUrn: string; // Helpful for context, though not strictly required for the sync logic
  deletedAt: string; // ISO Timestamp (Indexed for range queries)
}

/**
 * ✅ NEW: Represents a raw message held in the 'quarantined_messages' table.
 * Corresponds to TransportMessage (Wire Object).
 */
export interface QuarantineRecord {
  messageId: string; // Unique ID (PK)
  senderId: string; // Index for grouping requests
  sentTimestamp: string; // For sorting
  typeId: string; // To know how to parse later
  payloadBytes: Uint8Array; // Raw encrypted/unparsed content
  clientRecordId?: string; // Idempotency ID from the client
}
