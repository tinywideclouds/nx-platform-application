import { DecryptedMessage } from './chat.models';

/**
 * Generates a text snippet preview from a message's payload.
 * Used for the conversation index (sidebar preview).
 * * This logic must be binary safe.
 */
export function generateSnippet(msg: DecryptedMessage): string {
  if (msg.typeId.toString() === 'urn:message:type:text') {
    try {
      // ✅ Binary Safety: Ensures TextDecoder receives a valid TypedArray view
      // of the raw payloadBytes retrieved from storage (ArrayBuffer/Object).
      return new TextDecoder().decode(new Uint8Array(msg.payloadBytes));
    } catch {
      return 'Message'; // Fallback if decoding fails
    }
  }
  return 'Media Message';
}

/**
 * Determines the preview type (text/image/file) for rendering icons in the UI.
 */
export function getPreviewType(
  typeIdStr: string
): 'text' | 'image' | 'file' | 'other' {
  if (typeIdStr === 'urn:message:type:text') return 'text';
  if (typeIdStr.includes('image')) return 'image';
  if (typeIdStr.includes('file')) return 'file';
  return 'other';
}
