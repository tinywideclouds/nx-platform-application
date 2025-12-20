import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

// --- DOMAIN MODELS (Application) ---

export type MessageDeliveryStatus =
  | 'pending' // Local optimistic
  | 'sent' // Ack'd by Router
  | 'received' // Inbound from Router
  | 'read' // Read Receipt confirmed
  | 'failed'; // Timed out / Error

export interface DecryptedMessage {
  messageId: string;
  senderId: URN;
  recipientId: URN;
  sentTimestamp: ISODateTimeString;
  typeId: URN;
  payloadBytes: Uint8Array;
  status: MessageDeliveryStatus;
  conversationUrn: URN;
}

export interface Conversation {
  conversationUrn: URN;
  previewType: 'text' | 'image' | 'file' | 'other';
}

export interface ConversationSummary extends Conversation {
  timestamp: ISODateTimeString;
  latestSnippet: string;
  unreadCount: number;
}

export interface MessageTombstone {
  messageId: string;
  conversationUrn: URN; // Use URN, not string!
  deletedAt: ISODateTimeString;
}

// ✅ NEW: A clean, public contract for syncing Conversation State
export interface ConversationSyncState extends Conversation {
  snippet: string;
  unreadCount: number;
  lastActivityTimestamp: ISODateTimeString;
  genesisTimestamp: ISODateTimeString | null;
  lastModified: ISODateTimeString;
}
