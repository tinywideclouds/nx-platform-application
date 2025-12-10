// libs/messenger/message-content/src/lib/services/message-content-parser.service.ts

import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  ParsedMessage,
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_CONTACT_SHARE,
  MESSAGE_TYPE_READ_RECEIPT,
  ContactShareData,
  ReadReceiptData,
} from '../models/content-types';

@Injectable({
  providedIn: 'root',
})
export class MessageContentParser {
  // Configured to be permissive (don't crash on bad bytes, just fail logic)
  private decoder = new TextDecoder();

  /**
   * The "Router" Function.
   * Decides if the bytes are Content (Save) or Signal (Execute).
   */
  parse(typeId: URN, bytes: Uint8Array): ParsedMessage {
    const typeStr = typeId.toString();

    try {
      // --- ROUTE 1: SIMPLE CONTENT (Text) ---
      if (typeStr === MESSAGE_TYPE_TEXT) {
        return {
          kind: 'content',
          payload: {
            kind: 'text',
            text: this.decoder.decode(bytes),
          },
        };
      }

      // --- ROUTE 2: RICH CONTENT (Contact Share) ---
      if (typeStr === MESSAGE_TYPE_CONTACT_SHARE) {
        const json = this.decoder.decode(bytes);
        let data = {};
        try {
          data = JSON.parse(json);
        } catch {
          throw new Error('Payload is not valid JSON');
        }
        const contactData = data as ContactShareData;

        // Basic Schema Validation
        if (!contactData.urn || !contactData.alias) {
          throw new Error('Missing required fields for Contact Share');
        }

        return {
          kind: 'content',
          payload: {
            kind: 'rich',
            subType: typeStr,
            data,
          },
        };
      }

      // --- ROUTE 3: SIGNALS (System Commands) ---
      if (typeStr === MESSAGE_TYPE_READ_RECEIPT) {
        const json = this.decoder.decode(bytes);
        const data = JSON.parse(json) as ReadReceiptData;

        if (!Array.isArray(data.messageIds)) {
          throw new Error('Invalid Read Receipt Schema');
        }

        return {
          kind: 'signal',
          payload: {
            action: 'read-receipt',
            data,
          },
        };
      }

      // --- ROUTE 4: UNKNOWN ---
      return { kind: 'unknown', rawType: typeStr };
    } catch (error) {
      console.error(`[MessageContent] Parse Error for ${typeStr}`, error);
      return {
        kind: 'unknown',
        rawType: typeStr,
        error: error instanceof Error ? error.message : 'Parse Failed',
      };
    }
  }
}
