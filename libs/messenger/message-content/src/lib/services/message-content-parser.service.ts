// libs/messenger/message-content/src/lib/services/message-content-parser.service.ts

import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { 
  MessageContent, 
  MESSAGE_TYPE_TEXT, 
  MESSAGE_TYPE_CONTACT_SHARE, 
  ContactSharePayload 
} from '../models/content-types';

@Injectable({
  providedIn: 'root'
})
export class MessageContentParser {
  private decoder = new TextDecoder();

  /**
   * Parses raw message bytes into a structured MessageContent object based on the Type ID.
   * * @param typeId The URN identifying the content type.
   * @param bytes The raw decrypted payload bytes.
   */
  parse(typeId: URN, bytes: Uint8Array): MessageContent {
    const typeStr = typeId.toString();

    try {
      // 1. Text Message
      if (typeStr === MESSAGE_TYPE_TEXT) {
        const text = this.decoder.decode(bytes);
        return { type: 'text', text };
      }

      // 2. Contact Share
      if (typeStr === MESSAGE_TYPE_CONTACT_SHARE) {
        const jsonString = this.decoder.decode(bytes);
        const data = JSON.parse(jsonString) as ContactSharePayload;
        
        // Basic validation check
        if (!data.urn || !data.alias) {
          throw new Error('Invalid Contact Share schema');
        }

        return { type: 'contact-share', data };
      }

      // 3. Unknown Type
      return { 
        type: 'unknown', 
        rawType: typeStr, 
        error: 'Unsupported message type' 
      };

    } catch (error) {
      console.error('Message Content Parser Error:', error);
      return { 
        type: 'unknown', 
        rawType: typeStr, 
        error: 'Failed to parse payload' 
      };
    }
  }
}