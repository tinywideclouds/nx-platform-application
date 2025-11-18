// libs/messenger/chat-state/src/lib/services/chat-message.mapper.ts

import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { DecryptedMessage } from '@nx-platform-application/chat-storage';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

@Injectable({ providedIn: 'root' })
export class ChatMessageMapper {
  private logger = inject(Logger);
  private decoder = new TextDecoder();

  /**
   * Maps the storage model (DecryptedMessage) to the view model (ChatMessage).
   */
  toView(msg: DecryptedMessage): ChatMessage {
    let textContent = '';
    
    // Eagerly decode text for 'urn:sm:type:text'
    if (msg.typeId.toString() === 'urn:sm:type:text') {
      try {
        textContent = this.decoder.decode(msg.payloadBytes);
      } catch (e) {
        this.logger.error('Failed to decode text payload', e, msg);
        textContent = '[Error: Unreadable message]';
      }
    } else {
        textContent = 'Unsupported Message Type';
    }
    
    return {
      id: msg.messageId,
      conversationUrn: msg.conversationUrn,
      senderId: msg.senderId,
      sentTimestamp: msg.sentTimestamp as ISODateTimeString, // Pass through ISO string
      
      typeId: msg.typeId,
      payloadBytes: msg.payloadBytes,
      textContent: textContent,
    };
  }
}