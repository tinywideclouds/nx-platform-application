import { URN } from '@nx-platform-application/platform-types';
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
 * CONTRACT: Defines how the domain accesses message history.
 * Defined in Infrastructure. Consumed by Domain.
 */
export abstract class HistoryReader {
  abstract getMessages(query: HistoryQuery): Promise<HistoryResult>;
  abstract getConversationSummaries(): Promise<ConversationSummary[]>;
}
