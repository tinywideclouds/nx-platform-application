import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  ParsedMessage,
  ImageContent,
  ContactShareData,
  MessageTypeText,
  MessageTypeContactShare,
  MessageTypeImage,
} from '../models/content-types';
import {
  ContentParserStrategy,
  ParsingContext,
} from './content-parser.strategy';

@Injectable({ providedIn: 'root' })
export class TextParserStrategy implements ContentParserStrategy {
  private decoder = new TextDecoder();

  supports(typeId: URN): boolean {
    return typeId.equals(MessageTypeText);
  }

  parse(_: URN, content: Uint8Array, context: ParsingContext): ParsedMessage {
    const decodedText = this.decoder.decode(content);
    return {
      kind: 'content',
      conversationId: context.conversationId!, // Validator in main service ensures this exists
      tags: context.tags,
      payload: {
        kind: 'text',
        text: decodedText,
      },
    };
  }
}

@Injectable({ providedIn: 'root' })
export class ImageParserStrategy implements ContentParserStrategy {
  private decoder = new TextDecoder();

  supports(typeId: URN): boolean {
    // Basic string check, or distinct URN equality check
    return typeId.equals(MessageTypeImage);
  }

  parse(_: URN, content: Uint8Array, context: ParsingContext): ParsedMessage {
    const json = this.decoder.decode(content);
    const data = JSON.parse(json) as ImageContent;

    // Safety: Enforce kind
    data.kind = 'image';

    return {
      kind: 'content',
      conversationId: context.conversationId!,
      tags: context.tags,
      payload: data,
    };
  }
}

@Injectable({ providedIn: 'root' })
export class RichMediaParserStrategy implements ContentParserStrategy {
  private decoder = new TextDecoder();

  supports(typeId: URN): boolean {
    return typeId.equals(MessageTypeContactShare);
  }

  parse(
    typeId: URN,
    content: Uint8Array,
    context: ParsingContext,
  ): ParsedMessage {
    const data = JSON.parse(this.decoder.decode(content)) as ContactShareData;
    return {
      kind: 'content',
      conversationId: context.conversationId!,
      tags: context.tags,
      payload: {
        kind: 'rich',
        subType: typeId.toString(),
        data,
      },
    };
  }
}
