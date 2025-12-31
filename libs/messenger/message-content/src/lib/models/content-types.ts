// libs/messenger/message-content/src/lib/models/content-types.ts

import { URN } from '@nx-platform-application/platform-types';

// --- STANDARD TYPE REGISTRY ---

// Text
export const MESSAGE_TYPE_TEXT = 'urn:message:type:text';
export const MessageTypeText = URN.parse(MESSAGE_TYPE_TEXT);

// Contact Share
export const MESSAGE_TYPE_CONTACT_SHARE = 'urn:message:type:contact-share';
export const MessageTypeShare = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);

// Typing Indicator (Ephemeral)
export const MESSAGE_TYPE_TYPING = 'urn:message:type:typing-indicator';
export const MessageTypingIndicastor = URN.parse(MESSAGE_TYPE_TYPING);

// Device Sync ("Trojan Horse" for Key Exchange)
export const MESSAGE_TYPE_DEVICE_SYNC = 'urn:message:type:device-sync';

// Future Signals (Router Pattern)
export const MESSAGE_TYPE_READ_RECEIPT = 'urn:message:type:read-receipt';

// --- 1. PAYLOAD DEFINITIONS (The "Inside") ---

/**
 * The Data Structure for a Contact Share.
 */
export interface ContactShareData {
  urn: string;
  alias: string;
  text?: string;
  avatarUrl?: string;
}

/**
 * The "Simple" Content.
 * Zero overhead. Direct text access.
 */
export interface TextContent {
  kind: 'text';
  text: string;
}

/**
 * The "Rich" Content.
 * A bucket for structured data (JSON) that requires specific UI renderers.
 */
export interface RichContent {
  kind: 'rich';
  subType: string; // The URN string (e.g. 'urn:message:type:contact-share')
  data: ContactShareData | unknown;
}

/**
 * Union of all displayable content.
 */
export type ContentPayload = TextContent | RichContent;

// --- 2. SIGNAL DEFINITIONS (The "Command") ---

export interface ReadReceiptData {
  messageIds: string[];
  readAt: string; // ISO Timestamp
}

export interface SignalPayload {
  action: string;
  data: ReadReceiptData | unknown; // Typed union for better safety
}

// --- 3. ROUTER OUTPUT (The "Result") ---

/**
 * The Master Classification.
 * The Ingestion Service switches on 'kind' to decide WHERE to send the data.
 */
export type ParsedMessage =
  // A. SAVE IT: This is user content. Store in DB, update UI.
  | {
      kind: 'content';
      payload: ContentPayload;
      conversationId: URN; // Required for storage routing
      tags: URN[]; // For hierarchical filtering
    }

  // B. EXECUTE IT: This is a system command. Route to a handler.
  | { kind: 'signal'; payload: SignalPayload }

  // C. DROP IT: We don't know what this is.
  | { kind: 'unknown'; rawType: string; error?: string };
