import { URN } from '@nx-platform-application/platform-types';

// --- STANDARD TYPE REGISTRY ---
export const MESSAGE_TYPE_TEXT = 'urn:message:type:text';
export const MessageTypeText = URN.parse(MESSAGE_TYPE_TEXT);

export const MESSAGE_TYPE_GROUP_INVITATION =
  'urn:message:type:group-invitation';
export const MESSAGE_TYPE_GROUP_JOIN = 'urn:message:type:group-join';

export const MESSAGE_TYPE_CONTACT_SHARE = 'urn:message:type:contact-share';
export const MessageTypeShare = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);

export const MESSAGE_TYPE_TYPING = 'urn:message:type:typing-indicator';
export const MessageTypingIndicator = URN.parse(MESSAGE_TYPE_TYPING);

export const MESSAGE_TYPE_DEVICE_SYNC = 'urn:message:type:device-sync';
export const MESSAGE_TYPE_READ_RECEIPT = 'urn:message:type:read-receipt';

// --- 1. PAYLOAD DEFINITIONS ---

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

export interface RichContent {
  kind: 'rich';
  subType: string;
  data: ContactShareData;
}

export type ContentPayload = TextContent | RichContent;

// group message content

export interface GroupParticipantSnapshot {
  urn: string;
  alias?: string;
  role: 'owner' | 'admin' | 'member';
}

/**
 * The Contract sent to invitees.
 * Contains the "Consensus UUID" and the initial roster.
 */
export interface GroupInvitationData {
  groupUrn: string; // The Fixed Network UUID (Consensus Source of Truth)
  name: string;
  description?: string;

  // A snapshot of who *should* be in this group.
  participants: GroupParticipantSnapshot[];

  createdAt: string;
}

/**
 * The Signal sent back when a user accepts the invite.
 */
export interface GroupJoinData {
  groupUrn: string;
  acceptedAt: string;
}

// --- 2. SIGNAL DEFINITIONS ---

export interface ReadReceiptData {
  messageIds: string[];
  readAt: string; // ISO Timestamp
}

export interface SignalPayload {
  action: string;
  // REMOVED: | unknown.
  data: ReadReceiptData | null; // Typing uses null
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
