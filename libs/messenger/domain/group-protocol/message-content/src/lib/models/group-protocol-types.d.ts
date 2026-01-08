import { URN } from '@nx-platform-application/platform-types';
export declare const MESSAGE_TYPE_GROUP_INVITE = "urn:message:type:group-invite";
export declare const MessageGroupInvite: URN;
export declare const MESSAGE_TYPE_GROUP_INVITE_RESPONSE = "urn:message:type:group-invite-response";
export declare const MessageGroupInviteResponse: URN;
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
export interface GroupParticipantSnapshot {
    urn: string;
    alias?: string;
}
/**
 * The Contract sent to invitees.
 * Contains the "Consensus UUID" and the initial roster.
 */
export interface GroupInvitationData {
    groupUrn: string;
    name: string;
    description?: string;
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
export interface GroupSystemContent {
    kind: 'group-system';
    data: GroupJoinData;
}
