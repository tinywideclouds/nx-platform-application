import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';

@Injectable({ providedIn: 'root' })
export class MessageViewMapper {
  private logger = inject(Logger);
  private decoder = new TextDecoder('utf-8', { fatal: false });

  /**
   * Prepares a message for the UI by decoding text content from raw bytes.
   * This logic lives here (Domain) because it's about "Viewing", not "Storing".
   */
  toView(msg: ChatMessage): ChatMessage {
    // Idempotency check: If already decoded, return as is.
    if (msg.textContent !== undefined) {
      return msg;
    }

    let textContent: string | undefined = undefined;

    if (msg.typeId.equals(MessageTypeText)) {
      if (msg.payloadBytes && msg.payloadBytes.length > 0) {
        try {
          textContent = this.decoder.decode(msg.payloadBytes);
        } catch (e) {
          this.logger.error('MessageViewMapper: Failed to decode text', e);
          textContent = '[Error: Unreadable message]';
        }
      } else {
        textContent = '';
      }
    }

    return {
      ...msg,
      textContent,
    };
  }
}
