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

export type MessageStatus = 'pending' | 'sent' | 'received' | 'read';

export interface ChatMessage extends Message {
  id: string; // Unique message ID
  conversationUrn: URN;
  // Computed/Preview fields
  textContent?: string;
  payloadBytes?: Uint8Array;
  status?: MessageStatus;
}

// This will be the view model for the participant (contact or group)
export interface ChatParticipant {
  urn: URN;
  name: string;
  initials: string;
  profilePictureUrl?: string;
}
