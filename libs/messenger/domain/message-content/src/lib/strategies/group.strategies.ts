import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { ParsedMessage } from '../models/content-types';
import {
  GroupInvitePayload,
  GroupJoinData,
  MessageGroupInvite,
  MessageGroupInviteResponse,
} from '../models/group-protocol-types';
import {
  ContentParserStrategy,
  ParsingContext,
} from './content-parser.strategy';

@Injectable({ providedIn: 'root' })
export class GroupParserStrategy implements ContentParserStrategy {
  private decoder = new TextDecoder();

  supports(typeId: URN): boolean {
    return (
      typeId.equals(MessageGroupInvite) ||
      typeId.equals(MessageGroupInviteResponse)
    );
  }

  parse(
    typeId: URN,
    content: Uint8Array,
    context: ParsingContext,
  ): ParsedMessage {
    const json = this.decoder.decode(content);

    if (typeId.equals(MessageGroupInvite)) {
      const data = JSON.parse(json) as GroupInvitePayload;
      return {
        kind: 'content',
        conversationId: context.conversationId!,
        tags: context.tags,
        payload: { kind: 'group-invite', data },
      };
    }

    if (typeId.equals(MessageGroupInviteResponse)) {
      const data = JSON.parse(json) as GroupJoinData;
      return {
        kind: 'content',
        conversationId: context.conversationId!,
        tags: context.tags,
        payload: { kind: 'group-system', data },
      };
    }

    throw new Error(`GroupStrategy cannot parse ${typeId.toString()}`);
  }
}
