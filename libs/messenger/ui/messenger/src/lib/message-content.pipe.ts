import { Pipe, PipeTransform, inject } from '@angular/core';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import {
  DisplayMessage,
  MessagePart,
} from '@nx-platform-application/messenger-ui-chat';
import { parseMessageText } from './message-parser';

@Pipe({
  name: 'messageContent',
  standalone: true,
  pure: true,
})
export class MessageContentPipe implements PipeTransform {
  private parser = inject(MessageContentParser);

  transform(msg: ChatMessage): DisplayMessage | null {
    if (!msg.payloadBytes) return null;

    try {
      const parsed = this.parser.parse(msg.typeId, msg.payloadBytes);
      if (parsed.kind !== 'content') return null;

      const payload = parsed.payload;

      // 1. Text
      if (payload.kind === 'text') {
        return {
          id: msg.id,
          kind: 'text',
          parts: parseMessageText(payload.text),
        };
      }

      // 2. Image
      if (payload.kind === 'image') {
        return {
          id: msg.id,
          kind: 'image',
          parts: parseMessageText(payload.caption),
          image: {
            src: payload.inlineImage,
            width: payload.width,
            height: payload.height,
            assets: payload.assets,
          },
        };
      }

      // 3. Group System Events (Joined/Declined)
      if (payload.kind === 'group-system') {
        const status = payload.data.status;
        const parts: MessagePart[] = [];

        // Add Icon Part
        if (status === 'joined') {
          parts.push({ type: 'icon', ref: 'login', color: 'primary' });
          parts.push({ type: 'text', content: ' joined the group' });
        } else if (status === 'declined') {
          parts.push({ type: 'icon', ref: 'person_remove', color: 'warn' });
          parts.push({ type: 'text', content: ' declined the invite' });
        } else {
          parts.push({ type: 'icon', ref: 'info', color: 'primary' });
          parts.push({ type: 'text', content: ' updated the group' });
        }

        return {
          id: msg.id,
          kind: 'system',
          parts: parts,
        };
      }

      // 4. ✅ Group Invites (Action)
      if (payload.kind === 'group-invite') {
        return {
          id: msg.id,
          kind: 'action',
          parts: [], // Actions might have text, but usually custom rendered
          action: {
            type: 'group-invite',
            actionMap: {
              groupName: payload.data.name,
              groupUrn: payload.data.groupUrn,
            },
          },
        };
      }

      return null;
    } catch (e) {
      console.error('Error parsing message content', e);
      return null;
    }
  }
}
