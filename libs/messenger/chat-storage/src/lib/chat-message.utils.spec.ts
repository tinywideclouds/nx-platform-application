import { URN } from '@nx-platform-application/platform-types';
import { generateSnippet, getPreviewType } from './chat-message.utils';
import { DecryptedMessage } from './db/chat-storage.models';
import { describe, it, expect, vi } from 'vitest';

// --- Fixtures ---
const textUrn = URN.parse('urn:message:type:text');
const imageUrn = URN.parse('urn:message:type:image/jpeg');
const fileUrn = URN.parse('urn:message:type:file/pdf');

const createMsg = (
  typeId: URN,
  text: string = 'Test Text'
): DecryptedMessage => ({
  // Minimal data required for testing the utility functions
  messageId: 'id-1',
  senderId: URN.parse('urn:user:me'),
  recipientId: URN.parse('urn:user:bob'),
  sentTimestamp: '2024-01-01T00:00:00Z' as any,
  status: 'sent',
  conversationUrn: URN.parse('urn:conv:1'),
  typeId: typeId,
  payloadBytes: new TextEncoder().encode(text),
});

describe('ChatMessageUtils (Pure Functions)', () => {
  describe('generateSnippet', () => {
    it('should correctly decode and return text payload', () => {
      const msg = createMsg(textUrn, 'The quick brown fox');
      const snippet = generateSnippet(msg);
      expect(snippet).toBe('The quick brown fox');
    });

    it('should return fallback for non-text messages', () => {
      const msg = createMsg(imageUrn);
      const snippet = generateSnippet(msg);
      expect(snippet).toBe('Media Message');
    });

    it('should handle decoding failure and return fallback', () => {
      const msg = createMsg(textUrn);

      // Simulate corrupted/unreadable payload (not a valid byte sequence)
      msg.payloadBytes = new Uint8Array([255, 255]);

      const snippet = generateSnippet(msg);
      expect(snippet).toBe('Message');
    });

    // CRITICAL TEST: Ensures binary safety defense is working
    it('should correctly decode data retrieved as a raw ArrayBuffer (Binary Safety Check)', () => {
      const text = 'Binary Safety Check';
      const msg = createMsg(textUrn, text);

      // Simulate Dexie retrieval: data is retrieved as raw ArrayBuffer
      // The service needs to handle this internally.
      const rawArrayBuffer = msg.payloadBytes.buffer;

      // Temporarily change the payloadBytes property to simulate the corrupted state
      // when passed through an implicit retrieval channel.
      (msg.payloadBytes as any) = rawArrayBuffer;

      const snippet = generateSnippet(msg);
      expect(snippet).toBe(text);
    });
  });

  describe('getPreviewType', () => {
    it('should return "text" for text message URN', () => {
      expect(getPreviewType(textUrn.toString())).toBe('text');
    });

    it('should return "image" for image URNs', () => {
      expect(getPreviewType(imageUrn.toString())).toBe('image');
    });

    it('should return "file" for specific file URNs', () => {
      expect(getPreviewType(fileUrn.toString())).toBe('file');
    });

    it('should return "other" for unknown URNs', () => {
      expect(getPreviewType(URN.parse('urn:unknown:type').toString())).toBe(
        'other'
      );
    });
  });
});
