import { ChatMessage } from '@nx-platform-application/messenger-types';

/**
 * Generates a text snippet preview from a message's payload.
 * Used for the conversation index (sidebar preview).
 */
export function generateSnippet(msg: ChatMessage): string {
  // 1. Check Type & Payload Existence
  if (msg.typeId.toString() === 'urn:message:type:text' && msg.payloadBytes) {
    try {
      // 2. Binary Safety: Ensure we have a valid TypedArray
      // (Defensive programming against raw ArrayBuffers from storage adapters)
      return new TextDecoder().decode(new Uint8Array(msg.payloadBytes));
    } catch {
      return 'Message'; // Fallback if decoding fails
    }
  }

  // 3. Fallback for Media or Missing Payload
  return 'Media Message';
}

/**
 * Determines the preview type (text/image/file) for rendering icons in the UI.
 */
export function getPreviewType(
  typeIdStr: string,
): 'text' | 'image' | 'file' | 'other' {
  if (typeIdStr === 'urn:message:type:text') return 'text';
  if (typeIdStr.includes('image')) return 'image';
  if (typeIdStr.includes('file')) return 'file';
  return 'other';
}
