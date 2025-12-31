import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { DeliveryStatus } from '../models/outbound-task.model';

/**
 * Optimized for Dexie storage and indexing.
 * Uses primitives only to ensure serialization safety.
 */
export interface OutboxRecord {
  id: string; // Primary Key
  messageId: string;
  conversationUrn: string;
  typeId: string;
  payload: Uint8Array; // Raw binary storage
  tags: string[]; // Serialized URN array
  recipients: {
    urn: string; // Serialized URN
    status: 'pending' | 'sent' | 'failed';
    error?: string;
    attempts: number;
    lastAttempt?: string;
  }[];
  status: DeliveryStatus;
  createdAt: ISODateTimeString;
}
