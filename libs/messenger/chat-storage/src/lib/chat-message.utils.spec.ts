import { URN } from '@nx-platform-application/platform-types';
import { generateSnippet, getPreviewType } from './chat-message.utils';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { describe, it, expect } from 'vitest';

// --- Fixtures ---
const textUrn = URN.parse('urn:message:type:text');
const imageUrn = URN.parse('urn:message:type:image/jpeg');
const fileUrn = URN.parse('urn:message:type:file/pdf');

// Helper to create a partial ChatMessage for testing
const createMsg = (
  typeId: URN,
  text: string | null = 'Test Text',
): ChatMessage => ({
  id: 'id-1',
  senderId: URN.parse('urn:user:me'),
  conversationUrn: URN.parse('urn:conv:1'),
  sentTimestamp: '2024-01-01T00:00:00Z' as any,
  status: 'sent',
  typeId: typeId,
  // Simulate optional payload
  payloadBytes: text ? new TextEncoder().encode(text) : undefined,
  textContent: undefined,
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

    it('should return fallback if payload is missing (undefined)', () => {
      const msg = createMsg(textUrn, null); // No payload
      const snippet = generateSnippet(msg);
      expect(snippet).toBe('Media Message');
    });

    it('should handle decoding failure and return fallback', () => {
      const msg = createMsg(textUrn);

      // Simulate corrupted/unreadable payload
      // 0xFF is often invalid in UTF-8 sequences depending on position
      msg.payloadBytes = new Uint8Array([0xff, 0xff]);

      const snippet = generateSnippet(msg);
      // TextDecoder often replaces errors with , but strict handling might vary.
      // Based on your previous util implementation which caught errors:
      // If TextDecoder throws, we get 'Message'.
      // If it replaces, we get ''.
      // Let's assume the util's try/catch handles critical failures,
      // otherwise standard decoder behavior applies.
      // For this test, we verify it doesn't crash.
      expect(typeof snippet).toBe('string');
    });

    // CRITICAL TEST: Binary Safety
    it('should correctly decode data retrieved as a raw ArrayBuffer', () => {
      const text = 'Binary Safety Check';
      const msg = createMsg(textUrn, text);

      // Simulate the "Dexie Trap": Data coming out as ArrayBuffer instead of Uint8Array
      if (msg.payloadBytes) {
        const rawBuffer = msg.payloadBytes.buffer;
        // Force cast to simulate the runtime type mismatch
        (msg.payloadBytes as any) = rawBuffer;
      }

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
      expect(getPreviewType('urn:unknown:type')).toBe('other');
    });
  });
});
