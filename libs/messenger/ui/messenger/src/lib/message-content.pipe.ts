import { Pipe, PipeTransform, inject } from '@angular/core';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { DisplayMessage } from '@nx-platform-application/messenger-ui-chat';
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

      // 3. ✅ Group System Events (Joined/Declined)
      // Note: We use 'group-system' based on the domain types discussed
      if (payload.kind === 'group-system') {
        const status = payload.data.status;
        let text = 'updated the group';
        let icon = 'info';

        if (status === 'joined') {
          text = 'joined the group';
          icon = 'login';
        } else if (status === 'declined') {
          text = 'declined the invite';
          icon = 'person_remove';
        }

        return {
          id: msg.id,
          kind: 'system',
          parts: [],
          system: { text, icon },
        };
      }

      return { id: msg.id, kind: 'unknown', parts: [] };
    } catch (e) {
      console.warn('Message parsing failed', e);
      return null;
    }
  }
}
