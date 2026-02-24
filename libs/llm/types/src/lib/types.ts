import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

/**
 * Domain representation of a single chat message.
 * Now payload-agnostic to align with Messenger architecture.
 */
export interface LlmMessage {
  id: URN;
  sessionId: URN;

  // ✅ The Messenger Pattern
  typeId: URN; // e.g., urn:llm:message-type:text
  tags?: URN[];

  role: 'user' | 'model'; // Kept as specific union for indexing/logic

  payloadBytes: Uint8Array;

  isExcluded?: boolean;

  timestamp: ISODateTimeString;
}
