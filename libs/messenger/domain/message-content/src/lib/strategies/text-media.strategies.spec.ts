import { TestBed } from '@angular/core/testing';
import { URN } from '@nx-platform-application/platform-types';
import {
  TextParserStrategy,
  ImageParserStrategy,
} from './text-media.strategies';
import {
  ImageContent,
  MessageTypeText, // ✅ Correct Import
  MessageTypeImage, // ✅ Correct Import
} from '../models/content-types';

describe('Text & Media Strategies', () => {
  const mockContext = {
    conversationId: URN.parse('urn:messaging:conversation:1'),
    tags: [URN.parse('urn:tag:stream:1')],
  };
  const encoder = new TextEncoder();

  describe('TextParserStrategy', () => {
    let strategy: TextParserStrategy;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [TextParserStrategy] });
      strategy = TestBed.inject(TextParserStrategy);
    });

    it('should support text type', () => {
      // ✅ FIX: Use URN object directly
      expect(strategy.supports(MessageTypeText)).toBe(true);
      expect(strategy.supports(URN.parse('urn:other:type:audio'))).toBe(false);
    });

    it('should parse text content', () => {
      const bytes = encoder.encode('Hello World');
      // ✅ FIX: Use URN object directly
      const result = strategy.parse(MessageTypeText, bytes, mockContext);

      expect(result.kind).toBe('content');
      if (result.kind === 'content') {
        expect(result.payload.kind).toBe('text');
        expect((result.payload as any).text).toBe('Hello World');
        expect(result.conversationId).toBe(mockContext.conversationId);
      }
    });
  });

  describe('ImageParserStrategy', () => {
    let strategy: ImageParserStrategy;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [ImageParserStrategy] });
      strategy = TestBed.inject(ImageParserStrategy);
    });

    it('should support image type', () => {
      // ✅ FIX: Use URN object directly
      expect(strategy.supports(MessageTypeImage)).toBe(true);
    });

    it('should parse JSON image data', () => {
      // ✅ FIX: Match new ImageContent interface
      const imageData: ImageContent = {
        kind: 'image',
        inlineImage: 'data:img-base64', // Replaces thumbnailBase64
        decryptionKey: 'key',
        mimeType: 'image/png',
        width: 100,
        height: 100,
        sizeBytes: 500,
        caption: 'Caption',
        // assets: optional, omitted for this test
      };
      const bytes = encoder.encode(JSON.stringify(imageData));

      const result = strategy.parse(MessageTypeImage, bytes, mockContext);

      expect(result.kind).toBe('content');
      if (result.kind === 'content') {
        const payload = result.payload as ImageContent;
        expect(payload.kind).toBe('image');
        // ✅ FIX: Assert on new field
        expect(payload.inlineImage).toBe('data:img-base64');
        expect(payload.caption).toBe('Caption');
      }
    });
  });
});
