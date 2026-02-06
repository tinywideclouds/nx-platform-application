import { Priority, URN } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  MessageDeliveryStatus,
} from '@nx-platform-application/messenger-types';

export interface SendContext {
  conversationUrn: URN;
  recipientUrn: URN;
  optimisticMsg: ChatMessage;
  isEphemeral: boolean;
  shouldPersist: boolean;
  priority: Priority;
  recipients?: URN[];
}

export interface OutboundTarget {
  conversationUrn: URN; // The 'Context' (User or Group)
  recipients: URN[]; // The specific list of URN strings to fan-out to
}

export interface SendOptions {
  isEphemeral?: boolean;
  tags?: URN[];
  shouldPersist?: boolean;
  priority?: Priority;
}

export interface OutboundResult {
  message: ChatMessage;
  outcome: Promise<MessageDeliveryStatus>;
}

export abstract class SendStrategy {
  abstract getTargets(context: SendContext): Promise<OutboundTarget[]>;
}
