// libs/messenger/types/src/lib/draft-message.ts

/**
 * Represents a single file attachment pending upload.
 * This is "UI State" - it lives only in the browser's memory.
 */
export interface AttachmentItem {
  // The raw payload for the API
  file: File;

  // The lightweight "blob:http://..." URL for the <img> tag
  previewUrl: string;

  // Helpful metadata
  mimeType: string;
  name: string;
  size: number;
}

/**
 * Represents the full state of the input box before 'Send' is clicked.
 * It decouples the UI from the Backend "Message" entity.
 */
export interface DraftMessage {
  // The text currently in the input
  text: string;

  // The list of files (Empty array = text only)
  attachments: AttachmentItem[];
}
