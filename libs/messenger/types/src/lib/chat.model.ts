import {
  URN,
  ISODateTimeString,
  Resource,
} from '@nx-platform-application/platform-types';

export interface Message {
  senderId: URN;
  sentTimestamp: ISODateTimeString;
  typeId: URN;
}

export interface ChatMessage extends Message {
  id: string; // Unique message ID
  conversationUrn: URN;

  tags?: URN[];

  // Storage holds bytes; View computes text.
  payloadBytes?: Uint8Array;
  textContent?: string;
  status?: MessageDeliveryStatus;
  receiptMap?: Record<string, MessageDeliveryStatus>;
}

export type MessageDeliveryStatus =
  | 'pending' // Local optimistic
  | 'sent' // Ack'd by Router
  | 'received' // Inbound from Router
  | 'read' // Read Receipt confirmed
  | 'failed' // Timed out / Error
  | 'delivered' // Delivery is a general signal - group messages do not necessarily track all receipts
  | 'reference'; // Message is a reference to another message (History only, no delivery tracking)

// This will be the view model for the participant (contact or group)
export interface Conversation extends Resource {
  name: string; // ✅ Required

  // Content
  snippet: string; // ✅ Renamed from latestSnippet

  // Timestamps & Counters
  lastActivityTimestamp: ISODateTimeString; // ✅ Renamed from timestamp
  unreadCount: number;

  // Sync Metadata
  genesisTimestamp: ISODateTimeString | null;
  lastModified: ISODateTimeString;
}

// A clean, public contract for syncing Conversation State
export interface ConversationSyncState extends Conversation {
  name: string;
  snippet: string;
  unreadCount: number;
  lastActivityTimestamp: ISODateTimeString;
  genesisTimestamp: ISODateTimeString | null;
  lastModified: ISODateTimeString;
}

export interface MessageTombstone {
  messageId: string;
  conversationUrn: URN;
  deletedAt: ISODateTimeString;
}
