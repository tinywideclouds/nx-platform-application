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
import {
  MESSAGE_TYPE_GROUP_INVITE,
  MESSAGE_TYPE_GROUP_INVITE_RESPONSE,
  GroupInvitePayload,
  GroupJoinData,
} from '../models/group-protocol-types';
import { MessageMetadataService } from './message-metadata.service';

@Injectable({ providedIn: 'root' })
export class MessageContentParser {
  private metadataService = inject(MessageMetadataService);
  private decoder = new TextDecoder();

  parse(typeId: URN, rawBytes: Uint8Array): ParsedMessage {
    const typeStr = typeId.toString();

    try {
      // =========================================================
      // 1. CONTENT PATH (Persisted & Metadata Wrapped)
      // =========================================================
      if (
        typeStr === MESSAGE_TYPE_TEXT ||
        typeStr === MESSAGE_TYPE_CONTACT_SHARE ||
        typeStr === MESSAGE_TYPE_GROUP_INVITE ||
        typeStr === MESSAGE_TYPE_GROUP_INVITE_RESPONSE
      ) {
        const { conversationId, tags, content } =
          this.metadataService.unwrap(rawBytes);

        if (!conversationId) {
          throw new Error('Content message missing conversationId metadata');
        }

        const tagsArray = tags || [];

        // TEXT
        if (typeStr === MESSAGE_TYPE_TEXT) {
          return {
            kind: 'content',
            conversationId,
            tags: tagsArray,
            payload: { kind: 'text', text: this.decoder.decode(content) },
          };
        }

        // GROUP INVITE (JSON)
        if (typeStr === MESSAGE_TYPE_GROUP_INVITE) {
          const data = JSON.parse(
            this.decoder.decode(content),
          ) as GroupInvitePayload;
          return {
            kind: 'content',
            conversationId,
            tags: tagsArray,
            payload: { kind: 'group-invite', data },
          };
        }

        if (typeStr === MESSAGE_TYPE_GROUP_INVITE_RESPONSE) {
          const data = JSON.parse(
            this.decoder.decode(content),
          ) as GroupJoinData;
          return {
            kind: 'content',
            conversationId,
            tags: tagsArray,
            payload: { kind: 'group-system', data },
          };
        }

        // RICH CONTENT (Fallback/Contact Share)
        const data = JSON.parse(
          this.decoder.decode(content),
        ) as ContactShareData;
        return {
          kind: 'content',
          conversationId,
          tags: tagsArray,
          payload: { kind: 'rich', subType: typeStr, data },
        };
      }

      // =========================================================
      // 2. SIGNAL PATH (Ephemeral & Flat)
      // =========================================================

      // READ RECEIPT
      if (typeStr === MESSAGE_TYPE_READ_RECEIPT) {
        const data = JSON.parse(
          this.decoder.decode(rawBytes),
        ) as ReadReceiptData;
        return { kind: 'signal', payload: { action: 'read-receipt', data } };
      }

      // TYPING (Empty)
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
