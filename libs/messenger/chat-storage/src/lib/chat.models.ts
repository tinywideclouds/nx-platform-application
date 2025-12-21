import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

import { Conversation } from '@nx-platform-application/messenger-types';

// --- DOMAIN MODELS (Application) ---

export interface MessageTombstone {
  messageId: string;
  conversationUrn: URN;
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
