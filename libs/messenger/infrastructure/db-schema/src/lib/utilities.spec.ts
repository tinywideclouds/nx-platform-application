import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { generateSnippet, getPreviewType } from './utilities';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { describe, it, expect } from 'vitest';

const textUrn = URN.parse('urn:message:type:text');
const imageUrn = URN.parse('urn:message:type:image/jpeg');

const createMsg = (
  typeId: URN,
  text: string | null = 'Test Text',
): ChatMessage => ({
  id: 'id-1',
  senderId: URN.parse('urn:contacts:user:me'),
  conversationUrn: URN.parse('urn:messenger:group:conv1'),
  sentTimestamp: '2024-01-01T00:00:00Z' as ISODateTimeString,
  status: 'sent',
  typeId: typeId,
  payloadBytes: text ? new TextEncoder().encode(text) : undefined,
  textContent: undefined,
});

describe('Chat Storage Utilities', () => {
  describe('generateSnippet', () => {
    it('should decode text payload correctly', () => {
      const msg = createMsg(textUrn, 'Hello World');
      const snippet = generateSnippet(msg);
      expect(snippet).toBe('Hello World');
    });

    it('should return fallback for media types', () => {
      const msg = createMsg(imageUrn);
      const snippet = generateSnippet(msg);
      expect(snippet).toBe('Media Message');
    });

    it('should return fallback for missing payload', () => {
      const msg = createMsg(textUrn, null);
      const snippet = generateSnippet(msg);
      expect(snippet).toBe('Media Message');
    });

    it('should handle decoding errors gracefully', () => {
      const msg = createMsg(textUrn);
      // Malformed UTF-8 sequence to trigger decoder error handling
      msg.payloadBytes = new Uint8Array([0xff, 0xff]);
      const snippet = generateSnippet(msg);
      // Expect fallback string or empty string, but no crash
      expect(typeof snippet).toBe('string');
    });
  });

  describe('getPreviewType', () => {
    it('should identify text', () => {
      expect(getPreviewType('urn:message:type:text')).toBe('text');
    });

    it('should identify image', () => {
      expect(getPreviewType('urn:message:type:image/png')).toBe('image');
    });

    it('should identify file', () => {
      expect(getPreviewType('urn:message:type:file/pdf')).toBe('file');
    });

    it('should default to other', () => {
      expect(getPreviewType('urn:message:type:unknown')).toBe('other');
    });
  });
});
