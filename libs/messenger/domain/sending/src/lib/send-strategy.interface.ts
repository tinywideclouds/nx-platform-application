import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { URN } from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { OutboundResult } from '../outbound.service'; // Circular type ref fix below

export interface SendContext {
  myKeys: PrivateKeys;
  myUrn: URN;
  recipientUrn: URN; // The Group or User URN
  optimisticMsg: ChatMessage;
  isEphemeral: boolean;
}

/**
 * CONTRACT: Defines a method for delivering a message to a specific target type.
 */
export abstract class SendStrategy {
  abstract send(context: SendContext): Promise<OutboundResult>;
}
