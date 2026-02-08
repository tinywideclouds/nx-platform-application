import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  ParsedMessage,
  MessageTypingIndicator,
  ReadReceiptData,
  MessageTypeReadReceipt,
  MessageTypeSystem,
} from '../models/content-types';
import {
  ContentParserStrategy,
  ParsingContext,
} from './content-parser.strategy';

@Injectable({ providedIn: 'root' })
export class SignalParserStrategy implements ContentParserStrategy {
  private decoder = new TextDecoder();

  supports(typeId: URN): boolean {
    return (
      typeId.equals(MessageTypeReadReceipt) ||
      typeId.equals(MessageTypingIndicator)
    );
  }

  parse(
    typeId: URN,
    content: Uint8Array,
    context: ParsingContext,
  ): ParsedMessage {
    if (typeId.equals(MessageTypeReadReceipt)) {
      const data = JSON.parse(this.decoder.decode(content)) as ReadReceiptData;
      return {
        kind: 'signal',
        payload: { action: 'read-receipt', data },
        conversationId: context.conversationId, // [UPDATE] Pass context
      };
    }

    if (typeId.equals(MessageTypingIndicator)) {
      return {
        kind: 'signal',
        payload: { action: 'typing', data: null },
        conversationId: context.conversationId, // [UPDATE] Pass context
      };
    }

    throw new Error(`SignalStrategy cannot parse ${typeId.toString()}`);
  }
}

@Injectable({ providedIn: 'root' })
export class SystemParserStrategy implements ContentParserStrategy {
  private decoder = new TextDecoder();

  supports(typeId: URN): boolean {
    return typeId.equals(MessageTypeSystem);
  }

  parse(_: URN, content: Uint8Array, context: ParsingContext): ParsedMessage {
    const decodedText = this.decoder.decode(content);

    try {
      const data = JSON.parse(decodedText);

      if (data && typeof data === 'object' && 'status' in data) {
        return {
          kind: 'content',
          conversationId: context.conversationId!,
          tags: context.tags,
          payload: {
            kind: 'group-system',
            data: data,
          } as any,
        };
      }
    } catch (e) {
      // Legacy fallback
    }

    return {
      kind: 'content',
      conversationId: context.conversationId!,
      tags: context.tags,
      payload: {
        kind: 'text',
        text: decodedText,
      },
    };
  }
}
