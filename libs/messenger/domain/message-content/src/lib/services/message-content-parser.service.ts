// libs/messenger/domain/message-content/src/lib/services/message-content-parser.service.ts

import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  ParsedMessage,
  ContentPayload,
  MESSAGE_TYPE_ASSET_REVEAL, // ✅ Import
  AssetRevealData, // ✅ Import
} from '../models/content-types';
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
  private encoder = new TextEncoder();
  private decoder = new TextDecoder(); // ✅ FIXED: Added Decoder

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
      // ✅ 1. Signal Path: Asset Reveal
      if (typeStr === MESSAGE_TYPE_ASSET_REVEAL) {
        const data = JSON.parse(
          this.decoder.decode(rawBytes),
        ) as AssetRevealData;
        return {
          kind: 'signal',
          payload: { action: 'asset-reveal', data },
        };
      }

      // 2. Content Path (Wrapped)
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
   */
  serialize(payload: ContentPayload): Uint8Array {
    switch (payload.kind) {
      case 'text':
        return this.encoder.encode(payload.text);

      case 'image':
        return this.encoder.encode(JSON.stringify(payload));

      case 'group-invite':
      case 'group-system':
      case 'rich':
        return this.encoder.encode(JSON.stringify(payload.data));

      default:
        return new Uint8Array([]);
    }
  }
}
