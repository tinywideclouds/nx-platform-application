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

      if (parsed.kind === 'signal') {
        const action = parsed.payload.action;

        // Handle "User Joined" / "User Declined"
        if (action === 'group-join' || action === 'group-leave') {
          // The data might be wrapped, so we access it safely
          const data = parsed.payload.data as any;
          const status =
            data?.status || (action === 'group-join' ? 'joined' : 'left');

          const parts: MessagePart[] = [];

          if (status === 'joined') {
            parts.push({ type: 'icon', ref: 'login', color: 'primary' });
            parts.push({ type: 'text', content: ' joined the group' });
          } else if (status === 'declined') {
            parts.push({ type: 'icon', ref: 'person_remove', color: 'warn' });
            parts.push({ type: 'text', content: ' declined the invite' });
          }

          return {
            id: msg.id,
            kind: 'system',
            parts: parts,
          };
        }

        // Ignore other signals (Typing, Read Receipts)
        return null;
      }

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
        const parts: MessagePart[] = [];
        const groupName = payload.data.name;
        const participants = payload.data.participants || [];

        // ✅ SYNTHESIZE THE TEXT HERE
        // This effectively replaces the old "Created" signal
        parts.push({ type: 'text', content: ` created group "${groupName}"` });

        if (participants.length > 0) {
          parts.push({ type: 'text', content: ' with ' });
          const names = participants
            .map((p) => p.alias || 'Unknown')
            .join(', ');
          parts.push({ type: 'text', content: names });
        }

        return {
          id: msg.id,
          kind: 'action',
          parts: parts,
          action: {
            type: 'group-invite',
            actionMap: {
              groupName: payload.data.name,
              groupUrn: payload.data.groupUrn,
            },
          },
        };
      }

      return {
        id: 'something',
        kind: 'system',
        parts: [
          {
            type: 'text',
            content: 'System Message: ' + payload.data + ' ' + payload.kind,
          },
        ],
      };
    } catch (e) {
      console.error('Error parsing message content', e);
      return null;
    }
  }
}
