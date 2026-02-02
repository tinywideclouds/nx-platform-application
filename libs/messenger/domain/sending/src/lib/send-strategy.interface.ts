import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  MessageDeliveryStatus,
} from '@nx-platform-application/messenger-types';

export interface SendContext {
  myKeys: PrivateKeys;
  myUrn: URN;
  recipientUrn: URN; // The Context (Chat Window)
  optimisticMsg: ChatMessage;
  isEphemeral: boolean;
  shouldPersist: boolean;
  // ✅ NEW: The "Dumb" Strategy just iterates this list
  recipients?: URN[];
}

export interface SendOptions {
  isEphemeral?: boolean;
  tags?: URN[];
  shouldPersist?: boolean;
}

export interface OutboundResult {
  message: ChatMessage;
  outcome: Promise<MessageDeliveryStatus>;
}

export abstract class SendStrategy {
  abstract send(context: SendContext): Promise<OutboundResult>;
}
