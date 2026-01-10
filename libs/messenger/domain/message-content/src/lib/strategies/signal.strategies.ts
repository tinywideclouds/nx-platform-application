import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  ParsedMessage,
  MessageTypingIndicator,
  ReadReceiptData,
  MessageTypeReadReceipt,
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
    _context: ParsingContext,
  ): ParsedMessage {
    if (typeId.equals(MessageTypeReadReceipt)) {
      const data = JSON.parse(this.decoder.decode(content)) as ReadReceiptData;
      return { kind: 'signal', payload: { action: 'read-receipt', data } };
    }

    if (typeId.equals(MessageTypingIndicator)) {
      return { kind: 'signal', payload: { action: 'typing', data: null } };
    }

    throw new Error(`SignalStrategy cannot parse ${typeId.toString()}`);
  }
}
