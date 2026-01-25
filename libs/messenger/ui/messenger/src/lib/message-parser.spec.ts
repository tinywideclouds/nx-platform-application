import { describe, it, expect } from 'vitest';
import { parseMessageText } from './message-parser';

describe('MessageParser Utility', () => {
  describe('parseMessageText', () => {
    it('should return empty array for empty or undefined input', () => {
      expect(parseMessageText('')).toEqual([]);
      expect(parseMessageText(undefined)).toEqual([]);
    });

    it('should return a single text part for plain text', () => {
      const input = 'Just some regular text.';
      const result = parseMessageText(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'text', content: input });
    });

    it('should identify a lone URL', () => {
      const input = 'https://google.com';
      const result = parseMessageText(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'link', url: 'https://google.com' });
    });

    it('should split text surrounding a URL', () => {
      const input = 'Check out https://angular.io for docs.';
      const result = parseMessageText(input);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ type: 'text', content: 'Check out ' });
      expect(result[1]).toEqual({ type: 'link', url: 'https://angular.io' });
      // Note: Current naive regex captures trailing punctuation if no space
      // If we improve the regex later, this test will need updating.
      // For now, based on `[^\s]+`, 'docs.' includes the dot if attached?
      // Wait, 'for docs.' -> ' for docs.' is after the link.
      expect(result[2]).toEqual({ type: 'text', content: ' for docs.' });
    });

    it('should handle multiple links', () => {
      const input = 'See https://a.com and http://b.com';
      const result = parseMessageText(input);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ type: 'text', content: 'See ' });
      expect(result[1]).toEqual({ type: 'link', url: 'https://a.com' });
      expect(result[2]).toEqual({ type: 'text', content: ' and ' });
      expect(result[3]).toEqual({ type: 'link', url: 'http://b.com' });
    });

    it('should correctly tokenize multiple links (Correction)', () => {
      const input = 'Link1: https://a.com Link2: https://b.com';
      const result = parseMessageText(input);

      expect(result).toEqual([
        { type: 'text', content: 'Link1: ' },
        { type: 'link', url: 'https://a.com' },
        { type: 'text', content: ' Link2: ' },
        { type: 'link', url: 'https://b.com' },
      ]);
    });

    it('should ignore www. without http protocol (per current regex)', () => {
      // Your current regex requires http:// or https://
      const input = 'Go to www.google.com';
      const result = parseMessageText(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'text',
        content: 'Go to www.google.com',
      });
    });
  });
});
