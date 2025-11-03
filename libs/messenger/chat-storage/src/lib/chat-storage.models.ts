import { URN, ISODateTimeString } from '@nx-platform-application/platform-types';

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
  typeId: URN; // e.g., "urn:sm:type:text"
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
}
