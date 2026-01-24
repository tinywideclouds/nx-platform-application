import { Pipe, PipeTransform, inject } from '@angular/core';
import {
  MessageContentParser,
  ContentPayload,
} from '@nx-platform-application/messenger-domain-message-content';
import { ChatMessage } from '@nx-platform-application/messenger-types';

// ✅ Define the Enriched Type
export type EnrichedPayload = ContentPayload & { messageId: string };

@Pipe({
  name: 'messageContent',
  standalone: true,
  pure: true,
})
export class MessageContentPipe implements PipeTransform {
  private parser = inject(MessageContentParser);

  transform(msg: ChatMessage): EnrichedPayload | null {
    if (!msg.payloadBytes) return null;

    try {
      const parsed = this.parser.parse(msg.typeId, msg.payloadBytes);
      if (parsed.kind !== 'content') return null;

      // ✅ CLEVER PART: Spread the payload AND the ID into one object
      return {
        ...parsed.payload,
        messageId: msg.id,
      };
    } catch (e) {
      return null;
    }
  }
}
