import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  ParsedMessage,
  MESSAGE_TYPE_READ_RECEIPT,
  MESSAGE_TYPE_TYPING,
  ReadReceiptData,
} from '../models/content-types';
import {
  ContentParserStrategy,
  ParsingContext,
} from './content-parser.strategy';

@Injectable({ providedIn: 'root' })
export class SignalParserStrategy implements ContentParserStrategy {
  private decoder = new TextDecoder();

  supports(typeId: URN): boolean {
    const s = typeId.toString();
    return s === MESSAGE_TYPE_READ_RECEIPT || s === MESSAGE_TYPE_TYPING;
  }

  parse(
    typeId: URN,
    content: Uint8Array,
    _context: ParsingContext,
  ): ParsedMessage {
    const typeStr = typeId.toString();

    if (typeStr === MESSAGE_TYPE_READ_RECEIPT) {
      const data = JSON.parse(this.decoder.decode(content)) as ReadReceiptData;
      return { kind: 'signal', payload: { action: 'read-receipt', data } };
    }

    if (typeStr === MESSAGE_TYPE_TYPING) {
      return { kind: 'signal', payload: { action: 'typing', data: null } };
    }

    throw new Error(`SignalStrategy cannot parse ${typeStr}`);
  }
}
