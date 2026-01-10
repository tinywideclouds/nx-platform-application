// libs/messenger/domain/message-content/src/lib/models/content-types.ts

import { URN } from '@nx-platform-application/platform-types';

// ✅ IMPORT DOMAIN TYPES
import { GroupInviteContent, GroupSystemContent } from './group-protocol-types';

export const MESSAGE_TYPE_TEXT = 'urn:message:type:text';
export const MessageTypeText = URN.parse(MESSAGE_TYPE_TEXT);

export const MESSAGE_TYPE_IMAGE = 'urn:message:type:image';
export const MessageTypeImage = URN.parse(MESSAGE_TYPE_IMAGE);

export const MESSAGE_TYPE_CONTACT_SHARE = 'urn:message:type:contact-share';
export const MessageTypeContactShare = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);

// --- SIGNAL TYPES (System Side-Effects) ---
// Pattern: urn:message:signal:<action>

// Ephemeral Signals
export const MESSAGE_TYPE_TYPING = 'urn:message:signal:typing-indicator';
export const MessageTypingIndicator = URN.parse(MESSAGE_TYPE_TYPING);

export const MESSAGE_TYPE_DEVICE_SYNC = 'urn:message:signal:device-sync';

// Durable Signals (Persisted until applied)
const MESSAGE_TYPE_READ_RECEIPT = 'urn:message:signal:read-receipt';
export const MessageTypeReadReceipt = URN.parse(MESSAGE_TYPE_READ_RECEIPT);

const MESSAGE_TYPE_ASSET_REVEAL = 'urn:message:signal:asset-reveal';
export const MessageTypeAssetReveal = URN.parse(MESSAGE_TYPE_ASSET_REVEAL);

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

export interface ImageContent {
  kind: 'image';
  thumbnailBase64: string;
  remoteUrl: string;
  decryptionKey: string;
  mimeType: string;
  caption?: string;
  width: number;
  height: number;
  sizeBytes: number;
  fileName?: string;
}

export interface RichContent {
  kind: 'rich';
  subType: string;
  data: ContactShareData;
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
  readAt: string;
}

// ✅ NEW: Asset Reveal Data
export interface AssetRevealData {
  messageId: string; // The ID of the message to patch
  remoteUrl: string; // The new High-Res URL
}

// ✅ UPDATE: Add asset-reveal to SignalPayload union
export interface SignalPayload {
  action: 'read-receipt' | 'typing' | 'group-join' | 'asset-reveal';
  data: ReadReceiptData | AssetRevealData | null;
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
