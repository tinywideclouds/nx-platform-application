import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  MessageDeliveryStatus,
} from '@nx-platform-application/messenger-types';

export interface SendContext {
  myKeys: PrivateKeys;
  myUrn: URN;
  recipientUrn: URN; // The Group or User URN
  optimisticMsg: ChatMessage;
  // The Separation of Concerns
  isEphemeral: boolean; // Instruction for the Wire (Router)
  shouldPersist: boolean; // Instruction for the Disk (Librarian)
}

export interface SendOptions {
  isEphemeral?: boolean;
  tags?: URN[];
}

export interface OutboundResult {
  message: ChatMessage;
  outcome: Promise<MessageDeliveryStatus>;
}

/**
 * CONTRACT: Defines a method for delivering a message to a specific target type.
 */
export abstract class SendStrategy {
  abstract send(context: SendContext): Promise<OutboundResult>;
}
