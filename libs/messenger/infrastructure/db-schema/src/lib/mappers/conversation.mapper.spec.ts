import { TestBed } from '@angular/core/testing';
import { ConversationMapper } from './conversation.mapper';
import { URN } from '@nx-platform-application/platform-types';
import { ConversationIndexRecord } from '../records/conversation.record';
import { ConversationSummary } from '@nx-platform-application/messenger-types';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

describe('ConversationMapper', () => {
  let mapper: ConversationMapper;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ConversationMapper],
    });
    mapper = TestBed.inject(ConversationMapper);
  });

  describe('toDomain', () => {
    it('should map Record -> Domain and handle property renames', () => {
      const record: ConversationIndexRecord = {
        conversationUrn: 'urn:messenger:group:lisbon',
        lastActivityTimestamp: '2024-01-01T12:00:00Z' as any,
        snippet: 'See you there',
        previewType: 'text',
        unreadCount: 3,
        genesisTimestamp: null,
        lastModified: '2024-01-01T12:00:00Z' as any,
      };

      const domain = mapper.toDomain(record);

      expect(domain.conversationUrn.toString()).toBe(
        'urn:messenger:group:lisbon',
      );
      // MAPPING CHECK: lastActivityTimestamp -> timestamp
      expect(domain.timestamp).toBe('2024-01-01T12:00:00Z');
      // MAPPING CHECK: snippet -> latestSnippet
      expect(domain.latestSnippet).toBe('See you there');
      expect(domain.unreadCount).toBe(3);
    });
  });

  describe('toRecord', () => {
    it('should map Domain -> Record and generate metadata', () => {
      const domain: ConversationSummary = {
        conversationUrn: URN.parse('urn:messenger:group:lisbon'),
        timestamp: '2024-01-01T12:00:00Z' as any,
        latestSnippet: 'See you there',
        previewType: 'text',
        unreadCount: 0,
        latestMessage: undefined, // Summary doesn't always have full message
      } as any; // Cast as any because chat.model might have other fields

      // Mock Temporal
      const nowStr = '2025-01-01T00:00:00Z';
      const nowInstant = Temporal.Instant.from(nowStr);
      const originalNow = Temporal.Now.instant;
      Temporal.Now.instant = vi.fn(() => nowInstant);

      try {
        const record = mapper.toRecord(domain);

        expect(record.conversationUrn).toBe('urn:messenger:group:lisbon');
        expect(record.lastActivityTimestamp).toBe('2024-01-01T12:00:00Z');
        expect(record.snippet).toBe('See you there');
        expect(record.genesisTimestamp).toBeNull();
        expect(record.lastModified).toBe(nowStr);
      } finally {
        Temporal.Now.instant = originalNow;
      }
    });
  });
});
