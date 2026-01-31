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
   * Creates a standard Text Payload.
   */
  static createText(text: string): TextContent {
    return {
      kind: 'text',
      text,
    };
  }
}
