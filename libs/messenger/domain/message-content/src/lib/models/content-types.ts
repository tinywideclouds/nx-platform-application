// libs/messenger/domain/message-content/src/lib/models/content-types.ts

import { URN } from '@nx-platform-application/platform-types';
import { AssetResult } from '@nx-platform-application/platform-infrastructure-storage';

// ✅ IMPORT DOMAIN TYPES
import { GroupInviteContent, GroupSystemContent } from './group-protocol-types';

// this used to be 'signal' | 'type' but renamed to 'content' as both are types of message (hopefull no breaking change)
export const SIGNAL = 'signal';
export const CONTENT = 'content';
export type MessageType = 'signal' | 'content';

export const TEXT_MESSAGE_TYPE = 'text';
const TEXT_MESSAGE = 'urn:message:content:text';
export const MessageTypeText = URN.parse(TEXT_MESSAGE);

export const IMAGE_MESSAGE_TYPE = 'image';
const IMAGE_MESSAGE = 'urn:message:content:image';
export const MessageTypeImage = URN.parse(IMAGE_MESSAGE);

const MESSAGE_TYPE_CONTACT_SHARE = 'urn:message:content:contact-share';
export const MessageTypeContactShare = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);

// --- SIGNAL TYPES (System Side-Effects) ---
// Pattern: urn:message:signal:<action>

// Ephemeral Signals
const MESSAGE_TYPE_TYPING = 'urn:message:signal:typing-indicator';
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

  /**
   * Base64 encoded image data.
   * - Unconnected: A readable preview (~320px). This is the final image.
   * - Connected: A tiny blur (~32px). Used as a placeholder while `bubbleUrl` loads.
   */
  inlineImage: string;

  assets?: Record<string, AssetResult>;

  /** Optional display name (e.g. "sunset.jpg") */
  displayName?: string;

  /** User-provided caption text */
  caption?: string;

  /** Encryption key (if E2EE is active), otherwise undefined */
  decryptionKey?: string;

  // --- METADATA (Of the ORIGINAL Asset) ---

  mimeType: string;

  /** Original width in pixels (Used for Aspect Ratio calculation) */
  width: number;

  /** Original height in pixels */
  height: number;

  /** Original file size in bytes (For download indicators) */
  sizeBytes: number;
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
  assets: Record<string, AssetResult>;
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
  | { kind: 'unknown'; rawType: URN; error?: string };
