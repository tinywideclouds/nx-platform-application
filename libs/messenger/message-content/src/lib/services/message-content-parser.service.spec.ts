// libs/messenger/message-content/src/lib/services/message-content-parser.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { MessageContentParser } from './message-content-parser.service';
import { URN } from '@nx-platform-application/platform-types';
import { 
  MESSAGE_TYPE_TEXT, 
  MESSAGE_TYPE_CONTACT_SHARE,
  ContactSharePayload
} from '../models/content-types';

describe('MessageContentParser', () => {
  let service: MessageContentParser;
  const encoder = new TextEncoder();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MessageContentParser]
    });
    service = TestBed.inject(MessageContentParser);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Text Messages', () => {
    it('should decode simple UTF-8 text', () => {
      const typeId = URN.parse(MESSAGE_TYPE_TEXT);
      const bytes = encoder.encode('Hello World');

      const result = service.parse(typeId, bytes);

      expect(result.type).toBe('text');
      if (result.type === 'text') { // Guard for TS
        expect(result.text).toBe('Hello World');
      }
    });

    it('should decode empty text', () => {
      const typeId = URN.parse(MESSAGE_TYPE_TEXT);
      const bytes = encoder.encode('');

      const result = service.parse(typeId, bytes);

      expect(result.type).toBe('text');
      if (result.type === 'text') {
        expect(result.text).toBe('');
      }
    });
  });

  describe('Contact Share Messages', () => {
    it('should decode valid Contact Share JSON', () => {
      const typeId = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);
      const payload: ContactSharePayload = {
        urn: 'urn:sm:user:bob',
        alias: 'Bob',
        text: 'Check this out'
      };
      const bytes = encoder.encode(JSON.stringify(payload));

      const result = service.parse(typeId, bytes);

      expect(result.type).toBe('contact-share');
      if (result.type === 'contact-share') {
        expect(result.data).toEqual(payload);
      }
    });

    it('should return unknown on invalid JSON', () => {
      const typeId = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);
      const bytes = encoder.encode('{ "broken": json ');

      const result = service.parse(typeId, bytes);

      expect(result.type).toBe('unknown');
      if (result.type === 'unknown') {
        expect(result.error).toContain('Failed to parse');
      }
    });

    it('should return unknown on invalid Schema (missing fields)', () => {
      const typeId = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);
      const bytes = encoder.encode(JSON.stringify({ foo: 'bar' })); // Missing 'urn'

      const result = service.parse(typeId, bytes);

      expect(result.type).toBe('unknown');
      if (result.type === 'unknown') {
        expect(result.error).toContain('Failed to parse'); // Caught by validation throw
      }
    });
  });

  describe('Unknown Types', () => {
    it('should return unknown type object', () => {
      const typeId = URN.parse('urn:sm:type:unknown-future-thing');
      const bytes = encoder.encode('data');

      const result = service.parse(typeId, bytes);

      expect(result.type).toBe('unknown');
      if (result.type === 'unknown') {
        expect(result.rawType).toBe('urn:sm:type:unknown-future-thing');
        expect(result.error).toBe('Unsupported message type');
      }
    });
  });
});