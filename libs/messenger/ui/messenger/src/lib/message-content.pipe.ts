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

      // 1. Handle Text
      if (payload.kind === 'text') {
        return {
          id: msg.id,
          kind: 'text',
          parts: parseMessageText(payload.text),
        };
      }

      // 2. Handle Image
      if (payload.kind === 'image') {
        return {
          id: msg.id,
          kind: 'image',
          // Parse the caption for links
          parts: parseMessageText(payload.caption),
          image: {
            src: payload.inlineImage, // Map 'inlineImage' -> 'src'
            width: payload.width,
            height: payload.height,
            assets: payload.assets,
            // NOTE: If you need mimeType/decryptionKey in the UI later,
            // you must add them to the DisplayMessage interface.
          },
        };
      }

      return { id: msg.id, kind: 'unknown', parts: [] };
    } catch (e) {
      console.warn('Message parsing failed', e);
      return null;
    }
  }
}
