import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';

const MAX_SNIPPET_BYTES = 1024 * 5; // 5KB limit for text decoding

/**
 * Generates a text snippet preview from a message's payload.
 * Used for the conversation index (sidebar preview).
 */
export function generateSnippet(msg: ChatMessage): string {
  console.log('[SNIPPED GENERATION]', msg);
  // 1. Check Type & Payload Existence
  if (msg.typeId.equals(MessageTypeText) && msg.payloadBytes) {
    try {
      // 2. Performance Guard: Don't decode massive blobs on the main thread
      if (msg.payloadBytes.byteLength > MAX_SNIPPET_BYTES) {
        return 'Long Message';
      }

      // 3. Binary Safety: Ensure we have a valid TypedArray
      return new TextDecoder().decode(new Uint8Array(msg.payloadBytes));
    } catch {
      return 'Message'; // Fallback if decoding fails
    }
  }

  // 4. Fallback for Media or Missing Payload
  return 'Media Message';
}
