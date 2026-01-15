import { TestBed } from '@angular/core/testing';
import { MessageContentParser } from './message-content-parser.service';
import { MessageMetadataService } from './message-metadata.service';
import { URN } from '@nx-platform-application/platform-types';
import {
  ImageContent,
  MessageTypeText,
  MessageTypeImage,
} from '../models/content-types';
import { describe, it, expect, beforeEach } from 'vitest';

// Strategy Imports
import {
  TextParserStrategy,
  ImageParserStrategy,
  RichMediaParserStrategy,
} from '../strategies/text-media.strategies';
import { GroupParserStrategy } from '../strategies/group.strategies';
import { SignalParserStrategy } from '../strategies/signal.strategies';

describe('MessageContentParser (Integration)', () => {
  let service: MessageContentParser;
  let metadataService: MessageMetadataService;
  const encoder = new TextEncoder();

  const mockConversationId = URN.parse('urn:messenger:group:germany-1');
  const mockTag = URN.parse('urn:tag:germany:best-in-class');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MessageContentParser,
        MessageMetadataService,
        TextParserStrategy,
        ImageParserStrategy,
        RichMediaParserStrategy,
        GroupParserStrategy,
        SignalParserStrategy,
      ],
    });

    service = TestBed.inject(MessageContentParser);
    metadataService = TestBed.inject(MessageMetadataService);
  });

  describe('Content Path', () => {
    it('should parse Text messages via strategy', () => {
      const typeId = MessageTypeText;
      const rawText = 'Hello Strategy';
      const bytes = encoder.encode(rawText);
      const wrapped = metadataService.wrap(bytes, mockConversationId, [
        mockTag,
      ]);

      const result = service.parse(typeId, wrapped);

      expect(result.kind).toBe('content');
      if (result.kind === 'content') {
        expect(result.payload.kind).toBe('text');
        expect((result.payload as any).text).toBe(rawText);
      }
    });

    it('should parse Image messages via strategy', () => {
      const typeId = MessageTypeImage;
      // ✅ FIX: Match new ImageContent interface
      const img: ImageContent = {
        kind: 'image',
        inlineImage: 'data:abc',
        decryptionKey: 'k',
        mimeType: 'image/png',
        width: 10,
        height: 10,
        sizeBytes: 100,
      };
      const bytes = encoder.encode(JSON.stringify(img));
      const wrapped = metadataService.wrap(bytes, mockConversationId, []);

      const result = service.parse(typeId, wrapped);

      expect(result.kind).toBe('content');
      if (result.kind === 'content') {
        expect(result.payload.kind).toBe('image');
        expect((result.payload as ImageContent).inlineImage).toBe('data:abc');
      }
    });
  });

  describe('Unknown Types', () => {
    it('should return unknown for unsupported URNs', () => {
      const typeId = URN.parse('urn:foo:bar:1');
      const result = service.parse(typeId, new Uint8Array([]));

      expect(result.kind).toBe('unknown');
      if (result.kind === 'unknown') {
        expect(result.rawType).toBe(typeId);
      }
    });
  });
});
