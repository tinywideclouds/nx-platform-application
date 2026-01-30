import { ISODateTimeString } from '@nx-platform-application/platform-types';

/**
 * Represents a raw message held in the 'quarantined_messages' table.
 * Corresponds to TransportMessage (Wire Object).
 */
export interface QuarantineRecord {
  messageId: string; // Unique ID (PK)
  senderId: string; // Index for grouping requests
  sentTimestamp: ISODateTimeString; // For sorting
  typeId: string; // To know how to parse later
  payloadBytes: Uint8Array; // Raw encrypted/unparsed content
  clientRecordId?: string; // Idempotency ID from the client
}
