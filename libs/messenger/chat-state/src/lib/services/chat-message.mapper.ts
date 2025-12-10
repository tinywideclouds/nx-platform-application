import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { DecryptedMessage } from '@nx-platform-application/chat-storage';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

/**
 * Maps storage-level decrypted messages to UI-ready view models.
 * Handles text decoding and error states for malformed payloads.
 */
@Injectable({ providedIn: 'root' })
export class ChatMessageMapper {
  private logger = inject(Logger);
  // Configured with 'fatal: true' to throw exceptions on invalid UTF-8 sequences,
  // allowing us to catch and log malformed messages.
  private decoder = new TextDecoder('utf-8', { fatal: true });

  /**
   * Maps the storage model (DecryptedMessage) to the view model (ChatMessage).
   * @param msg The decrypted message from storage.
   * @returns A UI-ready ChatMessage object.
   */
  toView(msg: DecryptedMessage): ChatMessage {
    let textContent = '';

    // Eagerly decode text for 'urn:message:type:text'
    if (msg.typeId.toString() === 'urn:message:type:text') {
      try {
        textContent = this.decoder.decode(msg.payloadBytes);
      } catch (e) {
        this.logger.error(
          'ChatMessageMapper: Failed to decode text payload',
          e
        );
        textContent = '[Error: Unreadable message]';
      }
    } else {
      this.logger.warn('type id', msg.typeId.toString());
      textContent = 'Unsupported Message Type';
    }

    return {
      id: msg.messageId,
      conversationUrn: msg.conversationUrn,
      senderId: msg.senderId,
      sentTimestamp: msg.sentTimestamp as ISODateTimeString,

      typeId: msg.typeId,
      payloadBytes: msg.payloadBytes,
      textContent: textContent,
      status: msg.status,
    };
  }
}
