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

export interface MessageTombstone {
  messageId: string;
  conversationUrn: URN; // Use URN, not string!
  deletedAt: ISODateTimeString;
}

// ✅ NEW: A clean, public contract for syncing Conversation State
export interface ConversationSyncState {
  conversationUrn: URN;
  lastActivityTimestamp: ISODateTimeString;
  snippet: string;
  previewType: 'text' | 'image' | 'file' | 'other';
  unreadCount: number;
  genesisTimestamp: ISODateTimeString | null;
  lastModified: ISODateTimeString;
}
