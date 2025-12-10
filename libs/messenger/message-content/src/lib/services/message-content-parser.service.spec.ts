// libs/messenger/message-content/src/lib/services/message-content-parser.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { MessageContentParser } from './message-content-parser.service';
import { URN } from '@nx-platform-application/platform-types';
import {
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_CONTACT_SHARE,
  MESSAGE_TYPE_READ_RECEIPT,
  ContactShareData,
  ReadReceiptData,
} from '../models/content-types';

describe('MessageContentParser', () => {
  let service: MessageContentParser;
  const encoder = new TextEncoder();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MessageContentParser],
    });
    service = TestBed.inject(MessageContentParser);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Content Routing (Text)', () => {
    it('should route text messages to Content > Text', () => {
      const typeId = URN.parse(MESSAGE_TYPE_TEXT);
      const bytes = encoder.encode('Hello World');

      const result = service.parse(typeId, bytes);

      expect(result.kind).toBe('content');

      if (result.kind === 'content') {
        expect(result.payload.kind).toBe('text');
        // @ts-expect-error - Guarded by kind check above
        expect(result.payload.text).toBe('Hello World');
      }
    });
  });

  describe('Content Routing (Rich)', () => {
    it('should route contact shares to Content > Rich', () => {
      const typeId = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);
      const data: ContactShareData = {
        urn: 'urn:contacts:user:bob',
        alias: 'Bob',
        text: 'Check this out',
      };
      const bytes = encoder.encode(JSON.stringify(data));

      const result = service.parse(typeId, bytes);

      expect(result.kind).toBe('content');

      if (result.kind === 'content') {
        expect(result.payload.kind).toBe('rich');
        // @ts-expect-error - Guarded by kind check
        expect(result.payload.subType).toBe(MESSAGE_TYPE_CONTACT_SHARE);
        // @ts-expect-error - Guarded by kind check
        expect(result.payload.data).toEqual(data);
      }
    });

    it('should route invalid JSON to Unknown', () => {
      const typeId = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);
      const bytes = encoder.encode('{ "broken": json ');

      const result = service.parse(typeId, bytes);

      expect(result.kind).toBe('unknown');
      if (result.kind === 'unknown') {
        // The service catches JSON.parse errors
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe('Signal Routing', () => {
    it('should route Read Receipts to Signal', () => {
      const typeId = URN.parse(MESSAGE_TYPE_READ_RECEIPT);

      const receiptData: ReadReceiptData = {
        messageIds: ['msg-1', 'msg-2'],
        readAt: new Date().toISOString(),
      };
      const bytes = encoder.encode(JSON.stringify(receiptData));

      const result = service.parse(typeId, bytes);

      expect(result.kind).toBe('signal');

      if (result.kind === 'signal') {
        expect(result.payload.action).toBe('read-receipt');
        expect(result.payload.data).toEqual(receiptData);
      }
    });

    it('should fail Read Receipt with invalid schema', () => {
      const typeId = URN.parse(MESSAGE_TYPE_READ_RECEIPT);
      // Invalid: missing messageIds array
      const bytes = encoder.encode(JSON.stringify({ foo: 'bar' }));

      const result = service.parse(typeId, bytes);

      expect(result.kind).toBe('unknown');
    });
  });

  describe('Unknown Types', () => {
    it('should route undefined types to Unknown', () => {
      const typeId = URN.parse('urn:message:type:alien-tech');
      const bytes = encoder.encode('data');

      const result = service.parse(typeId, bytes);

      expect(result.kind).toBe('unknown');
      if (result.kind === 'unknown') {
        expect(result.rawType).toBe('urn:message:type:alien-tech');
      }
    });
  });
});
