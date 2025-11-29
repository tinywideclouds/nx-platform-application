// libs/messenger/chat-storage/src/lib/chat-storage.models.ts

import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

// --- STORAGE MODELS (Dexie) ---

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
 * NEW: The Meta-Index Record
 * Acts as the source of truth for the Inbox AND the scroll boundaries.
 */
export interface ConversationIndexRecord {
  /** Primary Key */
  conversationUrn: string;

  /** Sorting & UI (The "Inbox" View) */
  lastActivityTimestamp: string; // ISO String, indexed for fast sorting
  snippet: string; // Decrypted text preview
  previewType: 'text' | 'image' | 'file' | 'other';
  unreadCount: number;

  /** GENESIS LOGIC (The "Scroll" Boundaries) */
  // If set, we know history definitely starts here. Stop scrolling.
  genesisTimestamp: string | null;

  /** SYNC LOGIC (Optimistic Concurrency) */
  lastModified: string;
}

// --- DOMAIN MODELS (Application) ---

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

export interface ConversationSummary {
  conversationUrn: URN;
  latestSnippet: string;
  timestamp: ISODateTimeString;
  unreadCount: number;
  // Helpful for UI icons
  previewType: 'text' | 'image' | 'file' | 'other';
}
