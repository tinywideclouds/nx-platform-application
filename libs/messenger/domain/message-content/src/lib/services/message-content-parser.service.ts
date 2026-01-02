import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  ParsedMessage,
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_CONTACT_SHARE,
  MESSAGE_TYPE_READ_RECEIPT,
  MESSAGE_TYPE_TYPING,
  ContactShareData,
  ReadReceiptData,
} from '../models/content-types';
import { MessageMetadataService } from './message-metadata.service';

@Injectable({ providedIn: 'root' })
export class MessageContentParser {
  private metadataService = inject(MessageMetadataService);
  private decoder = new TextDecoder();

  parse(typeId: URN, rawBytes: Uint8Array): ParsedMessage {
    const typeStr = typeId.toString();

    try {
      // 1. Content Path: Requires Metadata Unwrapping
      if (
        typeStr === MESSAGE_TYPE_TEXT ||
        typeStr === MESSAGE_TYPE_CONTACT_SHARE
      ) {
        const { conversationId, tags, content } =
          this.metadataService.unwrap(rawBytes);

        if (!conversationId) {
          throw new Error('Content message missing conversationId metadata');
        }

        if (typeStr === MESSAGE_TYPE_TEXT) {
          return {
            kind: 'content',
            conversationId,
            tags: tags || [],
            payload: { kind: 'text', text: this.decoder.decode(content) },
          };
        }

        // Rich Content (Contact Share)
        const data = JSON.parse(
          this.decoder.decode(content),
        ) as ContactShareData;

        return {
          kind: 'content',
          conversationId,
          tags: tags || [],
          payload: { kind: 'rich', subType: typeStr, data },
        };
      }

      // 2. Signal Path: Lean and Flat
      if (typeStr === MESSAGE_TYPE_READ_RECEIPT) {
        const data = JSON.parse(
          this.decoder.decode(rawBytes),
        ) as ReadReceiptData;
        return { kind: 'signal', payload: { action: 'read-receipt', data } };
      }

      if (typeStr === MESSAGE_TYPE_TYPING) {
        return { kind: 'signal', payload: { action: 'typing', data: null } };
      }

      return { kind: 'unknown', rawType: typeStr };
    } catch (error) {
      return {
        kind: 'unknown',
        rawType: typeStr,
        error: error instanceof Error ? error.message : 'Parse Failed',
      };
    }
  }
}
