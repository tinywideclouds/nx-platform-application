import { URN } from '@nx-platform-application/platform-types';

// ✅ IMPORT DOMAIN TYPES
import {
  MESSAGE_TYPE_GROUP_INVITE,
  MESSAGE_TYPE_GROUP_INVITE_RESPONSE,
  GroupInviteContent,
  GroupJoinData,
  GroupSystemContent,
} from './group-protocol-types';
// --- STANDARD TYPE REGISTRY ---
export const MESSAGE_TYPE_TEXT = 'urn:message:type:text';
export const MessageTypeText = URN.parse(MESSAGE_TYPE_TEXT);

export const MESSAGE_TYPE_IMAGE = 'urn:message:type:image';
export const MessageTypeImage = URN.parse(MESSAGE_TYPE_IMAGE);

// Exporting constants from the domain file to keep this registry central
export { MESSAGE_TYPE_GROUP_INVITE, MESSAGE_TYPE_GROUP_INVITE_RESPONSE };

export const MESSAGE_TYPE_CONTACT_SHARE = 'urn:message:type:contact-share';
export const MessageTypeContactShare = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);

export const MESSAGE_TYPE_TYPING = 'urn:message:type:typing-indicator';
export const MessageTypingIndicator = URN.parse(MESSAGE_TYPE_TYPING);

export const MESSAGE_TYPE_DEVICE_SYNC = 'urn:message:type:device-sync';
export const MESSAGE_TYPE_READ_RECEIPT = 'urn:message:type:read-receipt';
export const MessageTypeReadReceipt = URN.parse(MESSAGE_TYPE_READ_RECEIPT);

// --- 1. PAYLOAD DEFINITIONS (CONTENT) ---

export interface ContactShareData {
  urn: string;
  alias: string;
  text?: string;
  avatarUrl?: string;
}

export interface TextContent {
  kind: 'text';
  text: string;
}

// ✅ NEW: Image Content Payload
export interface ImageContent {
  kind: 'image';

  // 1. The Instant Layer (Embedded)
  thumbnailBase64: string;

  // 2. The Cloud Layer (Encrypted Blob)
  remoteUrl: string;
  decryptionKey: string; // The specific key for this file (not the chat session key)
  mimeType: string;

  // 3. The Flexibility (Atomic Caption)
  caption?: string;

  // 4. Metadata
  width: number;
  height: number;
  sizeBytes: number;
  fileName?: string;
}

export interface RichContent {
  kind: 'rich';
  subType: string;
  data: ContactShareData; // Legacy support
}

export type ContentPayload =
  | TextContent
  | ImageContent
  | RichContent
  | GroupInviteContent
  | GroupSystemContent;

// --- 2. SIGNAL DEFINITIONS ---

export interface ReadReceiptData {
  messageIds: string[];
  readAt: string; // ISO Timestamp
}

export interface SignalPayload {
  action: 'read-receipt' | 'typing' | 'group-join';
  data: ReadReceiptData | null;
}

// --- 3. ROUTER OUTPUT ---

export type ParsedMessage =
  | {
      kind: 'content';
      payload: ContentPayload;
      conversationId: URN;
      tags: URN[];
    }
  | { kind: 'signal'; payload: SignalPayload }
  | { kind: 'unknown'; rawType: string; error?: string };
