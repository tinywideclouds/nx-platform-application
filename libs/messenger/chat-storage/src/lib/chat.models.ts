import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

// --- DOMAIN MODELS (Application) ---

export interface DecryptedMessage {
  messageId: string;
  senderId: URN;
  recipientId: URN;
  sentTimestamp: ISODateTimeString;
  typeId: URN;
  payloadBytes: Uint8Array;
  status: 'pending' | 'sent' | 'received' | 'read';
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
