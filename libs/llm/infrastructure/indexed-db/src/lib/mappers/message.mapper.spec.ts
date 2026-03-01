import { TestBed } from '@angular/core/testing';
import { LlmMessageMapper } from './message.mapper';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { LlmMessageRecord } from '../records/message.record';
import { LlmMessage } from '@nx-platform-application/llm-types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('LlmMessageMapper', () => {
  let mapper: LlmMessageMapper;
  const encoder = new TextEncoder();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LlmMessageMapper],
    });
    mapper = TestBed.inject(LlmMessageMapper);
  });

  describe('toDomain', () => {
    it('should correctly map a fully populated record to a domain object', () => {
      const record: LlmMessageRecord = {
        id: 'urn:llm:message:123',
        sessionId: 'urn:llm:session:456',
        typeId: 'urn:llm:type:text',
        role: 'user',
        payloadBytes: encoder.encode('Hello World'),
        timestamp: '2026-02-28T10:00:00Z' as ISODateTimeString,
        isExcluded: true,
        tags: ['urn:llm:tag:abc'],
      };

      const domain = mapper.toDomain(record);

      expect(domain.id.toString()).toBe('urn:llm:message:123');
      expect(domain.sessionId.toString()).toBe('urn:llm:session:456');
      expect(domain.typeId.toString()).toBe('urn:llm:type:text');
      expect(domain.role).toBe('user');
      expect(new TextDecoder().decode(domain.payloadBytes)).toBe('Hello World');
      expect(domain.timestamp).toBe('2026-02-28T10:00:00Z');
      expect(domain.isExcluded).toBe(true);
      expect(domain.tags?.[0].toString()).toBe('urn:llm:tag:abc');
    });
  });

  describe('toRecord', () => {
    it('should correctly map a domain object back to a database record', () => {
      const domain: LlmMessage = {
        id: URN.parse('urn:llm:message:999'),
        sessionId: URN.parse('urn:llm:session:888'),
        typeId: URN.parse('urn:llm:type:text'),
        role: 'model',
        payloadBytes: encoder.encode('Response'),
        timestamp: '2026-02-28T12:00:00Z' as ISODateTimeString,
        isExcluded: false,
        tags: undefined,
      };

      const record = mapper.toRecord(domain);

      expect(record.id).toBe('urn:llm:message:999');
      expect(record.sessionId).toBe('urn:llm:session:888');
      expect(record.typeId).toBe('urn:llm:type:text');
      expect(record.role).toBe('model');
      expect(record.isExcluded).toBe(false);
      expect(record.tags).toBeUndefined();
    });
  });
});
