import { TestBed } from '@angular/core/testing';
import { MessageContentParser } from './message-content-parser.service';
import { MessageMetadataService } from './message-metadata.service';
import { URN } from '@nx-platform-application/platform-types';
import {
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_CONTACT_SHARE,
  MESSAGE_TYPE_READ_RECEIPT,
  MESSAGE_TYPE_TYPING,
  ReadReceiptData,
} from '../models/content-types';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MessageContentParser', () => {
  let service: MessageContentParser;
  let metadataService: MessageMetadataService;
  const encoder = new TextEncoder();

  const mockConversationId = URN.parse('urn:messenger:group:germany-1');
  const mockTag = URN.parse('urn:tag:germany:best-in-class');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MessageContentParser, MessageMetadataService],
    });
    service = TestBed.inject(MessageContentParser);
    metadataService = TestBed.inject(MessageMetadataService);
  });

  describe('Content Path (Wrapped)', () => {
    it('should unwrap metadata and parse text messages', () => {
      const typeId = URN.parse(MESSAGE_TYPE_TEXT);
      const rawText = 'Hello Germany';
      const textBytes = encoder.encode(rawText);

      // Manually wrap to simulate OutboundService behavior
      const wrappedBytes = metadataService.wrap(textBytes, mockConversationId, [
        mockTag,
      ]);

      const result = service.parse(typeId, wrappedBytes);

      expect(result.kind).toBe('content');
      if (result.kind === 'content') {
        expect(result.conversationId.toString()).toBe(
          mockConversationId.toString(),
        );
        expect(result.tags[0].toString()).toBe(mockTag.toString());
        expect(result.payload.kind).toBe('text');
        // @ts-expect-error - Guarded by kind check
        expect(result.payload.text).toBe(rawText);
      }
    });

    it('should fail if content message is missing conversationId metadata', () => {
      const typeId = URN.parse(MESSAGE_TYPE_TEXT);
      const bytes = encoder.encode('Raw Unwrapped Text');

      const result = service.parse(typeId, bytes);

      expect(result.kind).toBe('unknown');
      if (result.kind === 'unknown') {
        expect(result.error).toContain('missing conversationId');
      }
    });
  });

  describe('Signal Path (Flat)', () => {
    it('should route Read Receipts directly without metadata wrapping', () => {
      const typeId = URN.parse(MESSAGE_TYPE_READ_RECEIPT);
      const receiptData: ReadReceiptData = {
        messageIds: ['msg-1'],
        readAt: new Date().toISOString(),
      };
      // Signals are NOT wrapped in the metadata JSON envelope
      const bytes = encoder.encode(JSON.stringify(receiptData));

      const result = service.parse(typeId, bytes);

      expect(result.kind).toBe('signal');
      if (result.kind === 'signal') {
        expect(result.payload.action).toBe('read-receipt');
        expect(result.payload.data).toEqual(receiptData);
        // Verify metadata fields are NOT present on signal type
        expect(result).not.toHaveProperty('conversationId');
        expect(result).not.toHaveProperty('tags');
      }
    });

    it('should route Typing Indicators as empty flat signals', () => {
      const typeId = URN.parse(MESSAGE_TYPE_TYPING);
      const bytes = new Uint8Array([]);

      const result = service.parse(typeId, bytes);

      expect(result.kind).toBe('signal');
      if (result.kind === 'signal') {
        expect(result.payload.action).toBe('typing');
      }
    });
  });

  describe('Error Handling', () => {
    it('should route malformed JSON in rich content to unknown', () => {
      const typeId = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);
      const contentBytes = encoder.encode('{ invalid }');
      const wrapped = metadataService.wrap(
        contentBytes,
        mockConversationId,
        [],
      );

      const result = service.parse(typeId, wrapped);

      expect(result.kind).toBe('unknown');
      if (result.kind === 'unknown') {
        expect(result.error).toBeTruthy();
      }
    });
  });
});
