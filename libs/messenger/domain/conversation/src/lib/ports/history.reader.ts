import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  ConversationSummary,
} from '@nx-platform-application/messenger-types';

export interface HistoryQuery {
  conversationUrn: URN;
  limit: number;
  beforeTimestamp?: string;
}

export interface HistoryResult {
  messages: ChatMessage[];
  genesisReached: boolean;
}

/**
 * PORT: Defines how the domain accesses message history.
 * Implementations (Adapters) must handle Storage I/O and Cloud Hydration.
 */
export abstract class HistoryReader {
  abstract getMessages(query: HistoryQuery): Promise<HistoryResult>;
  abstract getConversationSummaries(): Promise<ConversationSummary[]>;
}
