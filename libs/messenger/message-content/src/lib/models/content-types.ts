// libs/messenger/message-content/src/lib/models/content-types.ts

import { URN } from '@nx-platform-application/platform-types';
/**
 * Standard URNs for message types supported by the application.
 */
export const MESSAGE_TYPE_TEXT = 'urn:message:type:text';
export const MessageTypeText = URN.parse('urn:message:type:text');
export const MESSAGE_TYPE_CONTACT_SHARE = 'urn:message:type:contact-share';

/**
 * The JSON schema for the 'urn:message:type:contact-share' payload.
 */
export interface ContactSharePayload {
  /** The URN of the identity being shared (e.g., urn:contacts:user:bob-123) */
  urn: string;

  /** A snapshot of the name at the time of sharing */
  alias: string;

  /** Optional context/caption (e.g., "Here is Bob's info") */
  text?: string;

  /** Optional avatar snapshot URL */
  avatarUrl?: string;
}

/**
 * Discriminated Union representing the parsed content of a message.
 * The UI will switch on the 'type' field.
 */
export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'contact-share'; data: ContactSharePayload }
  | { type: 'unknown'; rawType: string; error?: string };
