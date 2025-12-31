import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MESSAGE_TYPE_TEXT } from '@nx-platform-application/message-content';

@Injectable({ providedIn: 'root' })
export class ChatMessageMapper {
  private logger = inject(Logger);
  private decoder = new TextDecoder('utf-8', { fatal: false });

  toView(msg: ChatMessage): ChatMessage {
    if (msg.textContent !== undefined) {
      return msg;
    }

    let textContent: string | undefined = undefined;

    if (msg.typeId.toString() === MESSAGE_TYPE_TEXT) {
      // 🔍 DEBUG INSTRUMENTATION
      if (msg.payloadBytes) {
        const p = msg.payloadBytes as any;
        const isView = p instanceof Uint8Array;
        const len = p.length;

        // Only log if something looks wrong (missing length or not a view)
        if (!isView || len === undefined) {
          this.logger.warn(`[Mapper Debug] ⚠️ ID: ${msg.id}`, {
            type: p.constructor.name,
            length: len,
            byteLength: p.byteLength,
            isArray: Array.isArray(p),
            isBuffer: p instanceof ArrayBuffer,
          });
        }
      } else {
        this.logger.warn(
          `[Mapper Debug] ❌ ID: ${msg.id} | Payload is missing`,
        );
      }

      if (msg.payloadBytes && msg.payloadBytes.length > 0) {
        try {
          textContent = this.decoder.decode(msg.payloadBytes);
        } catch (e) {
          this.logger.error('ChatMessageMapper: Failed to decode text', e);
          textContent = '[Error: Unreadable message]';
        }
      } else {
        textContent = '';
      }
    }

    this.logger.debug('mapped message', msg, textContent);

    return {
      ...msg,
      textContent,
    };
  }
}
