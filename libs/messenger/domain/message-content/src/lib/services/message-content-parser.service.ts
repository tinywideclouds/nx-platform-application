import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { ParsedMessage, ContentPayload } from '../models/content-types'; // ✅ Import ContentPayload
import { MessageMetadataService } from './message-metadata.service';

// Strategies
import { ContentParserStrategy } from '../strategies/content-parser.strategy';
import {
  TextParserStrategy,
  ImageParserStrategy,
  RichMediaParserStrategy,
} from '../strategies/text-media.strategies';
import { GroupParserStrategy } from '../strategies/group.strategies';
import { SignalParserStrategy } from '../strategies/signal.strategies';

@Injectable({ providedIn: 'root' })
export class MessageContentParser {
  private metadataService = inject(MessageMetadataService);
  private encoder = new TextEncoder(); // ✅ Add Encoder

  // Registry of Strategies
  private strategies: ContentParserStrategy[] = [
    inject(TextParserStrategy),
    inject(ImageParserStrategy),
    inject(GroupParserStrategy),
    inject(RichMediaParserStrategy),
    inject(SignalParserStrategy),
  ];

  /**
   * READ: Bytes -> Domain Object
   */
  parse(typeId: URN, rawBytes: Uint8Array): ParsedMessage {
    const typeStr = typeId.toString();

    try {
      const { conversationId, tags, content } =
        this.metadataService.unwrap(rawBytes);

      const strategy = this.strategies.find((s) => s.supports(typeId));

      if (strategy) {
        return strategy.parse(typeId, content, {
          conversationId,
          tags: tags || [],
        });
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

  /**
   * WRITE: Domain Object -> Bytes
   * This is the inverse of the strategies above.
   * Kept simple here to avoid updating 5 strategy files for now.
   */
  serialize(payload: ContentPayload): Uint8Array {
    switch (payload.kind) {
      case 'text':
        return this.encoder.encode(payload.text);

      case 'image':
        // Images are stored as the full JSON object
        return this.encoder.encode(JSON.stringify(payload));

      case 'group-invite':
      case 'group-system':
      case 'rich':
        // Wrapper types: We only persist the inner 'data' property
        return this.encoder.encode(JSON.stringify(payload.data));

      default:
        return new Uint8Array([]);
    }
  }
}
