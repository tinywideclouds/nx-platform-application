import { URN } from '@nx-platform-application/platform-types';

export const MESSAGE_TYPE_GROUP_INVITE = 'urn:message:type:group-invite';
export const MessageGroupInvite = URN.parse(MESSAGE_TYPE_GROUP_INVITE);

export const MESSAGE_TYPE_GROUP_INVITE_RESPONSE =
  'urn:message:type:group-invite-response';
export const MessageGroupInviteResponse = URN.parse(
  MESSAGE_TYPE_GROUP_INVITE_RESPONSE,
);

export interface GroupInviteContent {
  kind: 'group-invite';
  data: GroupInvitePayload;
}

export interface GroupInvitePayload {
  groupUrn: string;
  name: string;
  description?: string;
  inviterUrn: string;
}

// group message content

export interface GroupParticipantSnapshot {
  urn: string;
  alias?: string;
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
  status: 'joined' | 'declined';
  timestamp: string;
}

// ✅ NEW: Group System Message (Persistent)
// Used for "Joined", "Left", "Declined" events that appear in chat history.
export interface GroupSystemContent {
  kind: 'group-system';
  data: GroupJoinData;
}
