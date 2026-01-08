import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { ParsedMessage } from '../models/content-types';
import {
  MESSAGE_TYPE_GROUP_INVITE,
  MESSAGE_TYPE_GROUP_INVITE_RESPONSE,
  GroupInvitePayload,
  GroupJoinData,
} from '../models/group-protocol-types';
import {
  ContentParserStrategy,
  ParsingContext,
} from './content-parser.strategy';

@Injectable({ providedIn: 'root' })
export class GroupParserStrategy implements ContentParserStrategy {
  private decoder = new TextDecoder();

  supports(typeId: URN): boolean {
    const s = typeId.toString();
    return (
      s === MESSAGE_TYPE_GROUP_INVITE ||
      s === MESSAGE_TYPE_GROUP_INVITE_RESPONSE
    );
  }

  parse(
    typeId: URN,
    content: Uint8Array,
    context: ParsingContext,
  ): ParsedMessage {
    const typeStr = typeId.toString();
    const json = this.decoder.decode(content);

    if (typeStr === MESSAGE_TYPE_GROUP_INVITE) {
      const data = JSON.parse(json) as GroupInvitePayload;
      return {
        kind: 'content',
        conversationId: context.conversationId!,
        tags: context.tags,
        payload: { kind: 'group-invite', data },
      };
    }

    if (typeStr === MESSAGE_TYPE_GROUP_INVITE_RESPONSE) {
      const data = JSON.parse(json) as GroupJoinData;
      return {
        kind: 'content',
        conversationId: context.conversationId!,
        tags: context.tags,
        payload: { kind: 'group-system', data },
      };
    }

    throw new Error(`GroupStrategy cannot parse ${typeStr}`);
  }
}
