// This is a placeholder model.
// We should eventually use the real one from a types lib (e.g., @nx-platform-application/chat-storage)
// But this lets us build the component.
import { URN } from '@nx-platform-application/platform-types';

export interface ChatMessage {
  id: string; // Unique message ID
  conversationUrn: URN;
  senderId: URN;
  timestamp: Date;
  textContent: string;
  // We can add other types later, like 'image', 'file', 'system'
  type: 'text' | 'system';
}

// This will be the view model for the participant (contact or group)
export interface ChatParticipant {
  urn: URN;
  name: string;
  initials: string;
  profilePictureUrl?: string;
}