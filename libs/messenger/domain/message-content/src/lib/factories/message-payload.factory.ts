// libs/messenger/domain/message-content/src/lib/factories/message-payload.factory.ts

import { Temporal } from '@js-temporal/polyfill';
import { URN } from '@nx-platform-application/platform-types';
import {
  GroupInviteContent,
  GroupSystemContent,
  GroupParticipantSnapshot,
} from '../models/group-protocol-types';
import { TextContent } from '../models/content-types';

export class MessagePayloadFactory {
  /**
   * Creates a standardized Group Invite Payload.
   */
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

  /**
   * Creates a standardized "User Joined" Signal.
   */
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

  /**
   * Creates a standardized "User Declined" Signal.
   */
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

  /**
   * Creates a standard Text Payload.
   */
  static createText(text: string): TextContent {
    return {
      kind: 'text',
      text,
    };
  }
}
