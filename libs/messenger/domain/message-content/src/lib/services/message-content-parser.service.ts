import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  ParsedMessage,
  ContentPayload,
  MessageTypeAssetReveal,
  AssetRevealData,
  MessageTypeReadReceipt,
  ReadReceiptData,
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
  private decoder = new TextDecoder();

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
    try {
      // 1. Unwrap the Envelope (Sealed Sender)
      // Durable signals (Asset Reveal, Receipts) are wrapped to protect metadata/payloads.
      // We must unwrap before parsing the inner JSON.
      const { conversationId, tags, content } =
        this.metadataService.unwrap(rawBytes);

      // ✅ 2. Intercept Durable Signals (Post-Unwrap)
      // We explicitly classify these as 'signal' to prevent saving them as chat bubbles.
      // Using URN.equals() for structural comparison.

      if (typeId.equals(MessageTypeAssetReveal)) {
        const data = JSON.parse(
          this.decoder.decode(content),
        ) as AssetRevealData;
        return {
          kind: 'signal',
          payload: { action: 'asset-reveal', data },
        };
      }

      if (typeId.equals(MessageTypeReadReceipt)) {
        // console.log('parsing read receipt signal');
        const data = JSON.parse(
          this.decoder.decode(content),
        ) as ReadReceiptData;
        return {
          kind: 'signal',
          payload: { action: 'read-receipt', data },
        };
      }

      // console.log('searching for strategy to parse typeId:', typeId.toString());
      // 3. Delegate Content Parsing to Strategies
      const strategy = this.strategies.find((s) => s.supports(typeId));

      if (strategy) {
        return strategy.parse(typeId, content, {
          conversationId,
          tags: tags || [],
        });
      }

      return { kind: 'unknown', rawType: typeId };
    } catch (error) {
      return {
        kind: 'unknown',
        rawType: typeId,
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
