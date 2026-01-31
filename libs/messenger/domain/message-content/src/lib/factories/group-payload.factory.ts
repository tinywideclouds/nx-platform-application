import { Temporal } from '@js-temporal/polyfill';
import { URN } from '@nx-platform-application/platform-types';
import {
  GroupInviteContent,
  GroupSystemContent,
  GroupParticipantSnapshot,
} from '../models/group-protocol-types';

export class GroupPayloadFactory {
  static createGroupInvite(
    groupUrn: URN,
    inviterUrn: URN,
    name: string,
    participants: GroupParticipantSnapshot[],
    description?: string,
  ): GroupInviteContent {
    return {
      kind: 'group-invite',
      data: {
        groupUrn: groupUrn.toString(),
        name,
        inviterUrn: inviterUrn.toString(),
        participants,
        description,
      },
    };
  }

  static createJoinedSignal(groupUrn: URN): GroupSystemContent {
    return {
      kind: 'group-system',
      data: {
        groupUrn: groupUrn.toString(),
        status: 'joined',
        timestamp: Temporal.Now.instant().toString(),
      },
    };
  }

  static createDeclinedSignal(groupUrn: URN): GroupSystemContent {
    return {
      kind: 'group-system',
      data: {
        groupUrn: groupUrn.toString(),
        status: 'declined',
        timestamp: Temporal.Now.instant().toString(),
      },
    };
  }
  static createGroupCreatedSignal(
    groupUrn: URN,
    name: string,
    participantNames: string[],
  ): GroupSystemContent {
    return {
      kind: 'group-system',
      data: {
        groupUrn: groupUrn.toString(),
        status: 'created',
        timestamp: Temporal.Now.instant().toString(),
        // Encode the summary here so the UI can just display it
        details: `created group "${name}" with ${participantNames.join(', ')}`,
      },
    };
  }
}
