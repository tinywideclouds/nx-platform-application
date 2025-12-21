// This is a placeholder model.
// We should eventually use the real one from a types lib (e.g., @nx-platform-application/chat-storage)
// But this lets us build the component.
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

export interface Message {
  senderId: URN;
  sentTimestamp: ISODateTimeString;
  typeId: URN;
}

export interface ChatMessage extends Message {
  id: string; // Unique message ID
  conversationUrn: URN;
  // Computed/Preview fields
  textContent?: string;
  payloadBytes?: Uint8Array;
  status?: MessageDeliveryStatus;
}

export type MessageDeliveryStatus =
  | 'pending' // Local optimistic
  | 'sent' // Ack'd by Router
  | 'received' // Inbound from Router
  | 'read' // Read Receipt confirmed
  | 'failed'; // Timed out / Error

// This will be the view model for the participant (contact or group)
export interface ChatParticipant {
  urn: URN;
  name: string;
  initials: string;
  profilePictureUrl?: string;
}

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
