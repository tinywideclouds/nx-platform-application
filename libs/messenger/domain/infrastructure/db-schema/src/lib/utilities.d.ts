import { ChatMessage } from '@nx-platform-application/messenger-types';
/**
 * Generates a text snippet preview from a message's payload.
 * Used for the conversation index (sidebar preview).
 */
export declare function generateSnippet(msg: ChatMessage): string;
/**
 * Determines the preview type (text/image/file) for rendering icons in the UI.
 */
export declare function getPreviewType(typeIdStr: string): 'text' | 'image' | 'file' | 'other';
