import { Pipe, PipeTransform, inject } from '@angular/core';
import {
  MessageContentParser,
  ContentPayload,
} from '@nx-platform-application/messenger-domain-message-content';
import { ChatMessage } from '@nx-platform-application/messenger-types';

@Pipe({
  name: 'messageContent',
  standalone: true,
  pure: true, // Crucial: Only re-runs if 'msg' reference changes
})
export class MessageContentPipe implements PipeTransform {
  private parser = inject(MessageContentParser);

  transform(msg: ChatMessage): ContentPayload | null {
    if (!msg.payloadBytes) return null;

    try {
      // This is now safe because the pipe memoizes the result.
      // We won't re-parse on every change detection cycle.
      const parsed = this.parser.parse(msg.typeId, msg.payloadBytes);
      return parsed.kind === 'content' ? parsed.payload : null;
    } catch (e) {
      return null;
    }
  }
}
