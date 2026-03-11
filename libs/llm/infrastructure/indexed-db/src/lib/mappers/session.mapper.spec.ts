// libs/llm/infrastructure/indexed-db/src/lib/mappers/session.mapper.spec.ts
import { TestBed } from '@angular/core/testing';
import { LlmSessionMapper } from './session.mapper';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { LlmSessionRecord } from '../records/session.record';
import { LlmSession } from '@nx-platform-application/llm-types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('LlmSessionMapper', () => {
  let mapper: LlmSessionMapper;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LlmSessionMapper] });
    mapper = TestBed.inject(LlmSessionMapper);
  });

  describe('toDomain', () => {
    it('should cleanly map the new explicit intent buckets', () => {
      const record: LlmSessionRecord = {
        id: 'urn:llm:session:1',
        title: 'Modern Session',
        lastModified: '2026-02-28T10:00:00Z' as ISODateTimeString,
        inlineContexts: [
          {
            id: 'urn:llm:attachment:1',
            resourceUrn: 'urn:data-source:repo:123',
            resourceType: 'source',
          },
        ],
        systemContexts: [],
        compiledContext: undefined,
      };

      const domain = mapper.toDomain(record);

      // Verify the intent pointers mapped correctly
      expect(domain.inlineContexts).toBeDefined();
      expect(domain.inlineContexts![0].id.toString()).toBe(
        'urn:llm:attachment:1',
      );
      expect(domain.inlineContexts![0].resourceUrn.toString()).toBe(
        'urn:data-source:repo:1',
      );
    });
  });

  describe('toRecord', () => {
    it('should map the pure intent buckets directly to the database record', () => {
      const domain: LlmSession = {
        id: URN.parse('urn:llm:session:3'),
        title: 'Save Session',
        lastModified: '2026-02-28T10:00:00Z' as ISODateTimeString,
        llmModel: 'gemini-1.5-pro',
        inlineContexts: [],
        systemContexts: [],
        compiledContext: {
          id: URN.parse('urn:llm:attachment:2'),
          resourceUrn: URN.parse('urn:data-source:group:abc'),
          resourceType: 'group',
        },
      };

      const record = mapper.toRecord(domain);

      // Verify intent pointer is saved perfectly
      expect(record.compiledContext).toBeDefined();
      expect(record.compiledContext?.resourceUrn).toBe(
        'urn:data-source:group:abc',
      );
      expect(record.compiledContext?.resourceType).toBe('group');

      // Verify basic fields
      expect(record.llmModel).toBe('gemini-1.5-pro');
    });
  });
});
