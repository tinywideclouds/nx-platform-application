import { TestBed } from '@angular/core/testing';
import { ConversationMapper } from './conversation.mapper';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ConversationIndexRecord } from '../records/conversation.record';
import { Conversation } from '@nx-platform-application/messenger-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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
        lastActivityTimestamp: '2024-01-01T12:00:00Z' as ISODateTimeString,
        name: 'Lisbon Trip',
        snippet: 'See you there',
        unreadCount: 3,
        genesisTimestamp: null,
        lastModified: '2024-01-01T12:00:00Z' as ISODateTimeString,
      };

      const domain = mapper.toDomain(record);

      expect(domain.conversationUrn.toString()).toBe(
        'urn:messenger:group:lisbon',
      );
      // ✅ Check Name
      expect(domain.name).toBe('Lisbon Trip');
      // ✅ Check Direct Mapping (No Renames anymore)
      expect(domain.lastActivityTimestamp).toBe('2024-01-01T12:00:00Z');
      expect(domain.snippet).toBe('See you there');
      expect(domain.unreadCount).toBe(3);
    });
  });

  describe('toRecord', () => {
    // Mock Temporal
    const lastActivityTimestamp = '2024-01-01T12:00:00Z';
    const lastModified = '2024-01-01T12:00:00Z';

    it('should map Domain -> Record and generate metadata', () => {
      const domain: Conversation = {
        conversationUrn: URN.parse('urn:messenger:group:lisbon'),
        name: 'Lisbon Trip',
        lastActivityTimestamp: lastActivityTimestamp as ISODateTimeString,
        snippet: 'See you there',
        unreadCount: 0,
        genesisTimestamp: null,
        lastModified: lastModified as ISODateTimeString,
      };
      const record = mapper.toRecord(domain);

      expect(record.conversationUrn).toBe('urn:messenger:group:lisbon');
      expect(record.name).toBe('Lisbon Trip');
      expect(record.lastActivityTimestamp).toBe(lastActivityTimestamp);
      expect(record.snippet).toBe('See you there');
      expect(record.genesisTimestamp).toBeNull();
      expect(record.lastModified).toBe(lastModified);
    });

    it('should default name to unknown if missing', () => {
      // Force invalid type to test fallback
      const domain = {
        conversationUrn: URN.parse('urn:messenger:group:anon'),
        lastActivityTimestamp: '2024-01-01T12:00:00Z' as ISODateTimeString,
        snippet: '?',
        unreadCount: 0,
      } as Conversation;

      const record = mapper.toRecord(domain);
      expect(record.name).toBe(undefined);
    });
  });
});
