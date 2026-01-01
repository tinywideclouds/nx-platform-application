import {
  ChatMessage,
  TransportMessage,
} from '@nx-platform-application/messenger-types';
import { URN } from '@nx-platform-application/platform-types';

/**
 * CONTRACT: The Domain needs a place to hold untrusted messages
 * before they are decrypted or accepted into history.
 */
export abstract class QuarantineStorage {
  /**
   * Saves a raw transport message (wire format) into the holding area.
   */
  abstract saveQuarantinedMessage(message: TransportMessage): Promise<void>;

  /**
   * Retrieves messages from a specific sender for inspection.
   * Returns them as "Received" ChatMessages for preview.
   */
  abstract getQuarantinedMessages(senderId: URN): Promise<ChatMessage[]>;

  /**
   * Returns a list of all unique senders currently in quarantine.
   * Used to show the "Message Requests" badge.
   */
  abstract getQuarantinedSenders(): Promise<URN[]>;

  /**
   * Deletes all messages from a specific sender (e.g., after Accept or Block).
   */
  abstract deleteQuarantinedMessages(senderId: URN): Promise<void>;
}
