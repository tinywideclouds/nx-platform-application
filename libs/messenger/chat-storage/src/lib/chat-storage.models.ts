// libs/messenger/chat-storage/src/lib/chat-storage.models.ts

import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

// PublicKeyRecord REMOVED (Moved to key-storage)

/**
 * This is the shape of the data as it will be in Dexie
 * We convert URNs to strings for storage.
 */
export interface MessageRecord {
  messageId: string;
  senderId: string;
  recipientId: string;
  sentTimestamp: ISODateTimeString;
  typeId: string;
  payloadBytes: Uint8Array;
  status: 'pending' | 'sent' | 'received';
  conversationUrn: string;
}

/**
 * The "smart" model for a fully decrypted and verified message.
 */
export interface DecryptedMessage {
  messageId: string;
  senderId: URN;
  recipientId: URN;
  sentTimestamp: ISODateTimeString;
  typeId: URN;
  payloadBytes: Uint8Array;
  status: 'pending' | 'sent' | 'received';
  conversationUrn: URN;
}

/**
 * A lightweight summary of a conversation.
 */
export interface ConversationSummary {
  conversationUrn: URN;
  latestSnippet: string;
  timestamp: ISODateTimeString;
  unreadCount: number;
}

export interface ConversationMetadata {
  conversationUrn: string;
  genesisTimestamp: string | null; // Null = Unknown/Not reached. String = The absolute beginning.
  lastSyncedAt: string;
}
