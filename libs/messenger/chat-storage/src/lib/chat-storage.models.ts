import { URN, ISODateTimeString } from '@nx-platform-application/platform-types';

/**
 * Defines the shape of a key record in IndexedDB.
 * We store the URN as a string (primary key) and the
 * keys as a JSON-safe object (base64 strings).
 */
export interface PublicKeyRecord {
  urn: string;
  keys: Record<string, string>;
  timestamp: ISODateTimeString;
}
// This is the shape of the data as it will be in Dexie
// We convert URNs to strings for storage.
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
 * This is the object that will be stored in IndexedDb and
 * held in the application's state (signals).
 */
export interface DecryptedMessage {
  // --- Core Fields ---
  messageId: string; // The *router-generated* ACK ID
  senderId: URN;
  recipientId: URN;
  sentTimestamp: ISODateTimeString;
  typeId: URN; 
  payloadBytes: Uint8Array;

  // --- Client-Side Fields ---
  status: 'pending' | 'sent' | 'received';
  conversationUrn: URN;
}

/**
 * A lightweight summary of a conversation, used to
 * populate the main chat list.
 */
export interface ConversationSummary {
  conversationUrn: URN;
  latestSnippet: string; // Decrypted plaintext of the last message
  timestamp: ISODateTimeString;
  unreadCount: number;
}
