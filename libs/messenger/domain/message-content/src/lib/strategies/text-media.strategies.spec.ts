import { TestBed } from '@angular/core/testing';
import { URN } from '@nx-platform-application/platform-types';
import {
  TextParserStrategy,
  ImageParserStrategy,
} from './text-media.strategies';
import {
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_IMAGE,
  ImageContent,
  MessageTypeText,
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
      expect(strategy.supports(MessageTypeText)).toBe(true);
      expect(strategy.supports(URN.parse('urn:other:type:audio'))).toBe(false);
    });

    it('should parse text content', () => {
      const bytes = encoder.encode('Hello World');
      const result = strategy.parse(
        URN.parse(MESSAGE_TYPE_TEXT),
        bytes,
        mockContext,
      );

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
      expect(strategy.supports(URN.parse(MESSAGE_TYPE_IMAGE))).toBe(true);
    });

    it('should parse JSON image data', () => {
      const imageData: ImageContent = {
        kind: 'image',
        thumbnailBase64: 'data:img',
        remoteUrl: 'http://url',
        decryptionKey: 'key',
        mimeType: 'image/png',
        width: 100,
        height: 100,
        sizeBytes: 500,
        caption: 'Caption',
      };
      const bytes = encoder.encode(JSON.stringify(imageData));

      const result = strategy.parse(
        URN.parse(MESSAGE_TYPE_IMAGE),
        bytes,
        mockContext,
      );

      expect(result.kind).toBe('content');
      if (result.kind === 'content') {
        const payload = result.payload as ImageContent;
        expect(payload.kind).toBe('image');
        expect(payload.remoteUrl).toBe('http://url');
        expect(payload.caption).toBe('Caption');
      }
    });
  });
});
