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
    TestBed.configureTestingModule({
      providers: [LlmSessionMapper],
    });
    mapper = TestBed.inject(LlmSessionMapper);
  });

  describe('toDomain', () => {
    it('should correctly map standard V2 attachments to domain objects', () => {
      const record: LlmSessionRecord = {
        id: 'urn:llm:session:1',
        title: 'Modern Session',
        lastModified: '2026-02-28T10:00:00Z' as ISODateTimeString,
        geminiCache: 'cached/123',
        llmModel: 'gemini-1.5-pro',
        attachments: [
          {
            id: 'att-1',
            cacheId: 'urn:llm:repo:frontend',
            target: 'gemini-cache',
          },
        ],
      };

      const domain = mapper.toDomain(record);

      expect(domain.attachments).toHaveLength(1);
      expect(domain.attachments[0].id).toBe('att-1');
      expect(domain.attachments[0].cacheId.toString()).toBe(
        'urn:llm:repo:frontend',
      );
      expect(domain.attachments[0].target).toBe('gemini-cache');
      expect(domain.geminiCache).toBe('cached/123');
    });

    it('should auto-migrate legacy cacheId into a default inline-context attachment', () => {
      // Missing attachments array, but has legacy cacheId
      const legacyRecord: any = {
        id: 'urn:llm:session:2',
        title: 'Legacy Session',
        lastModified: '2026-02-28T10:00:00Z' as ISODateTimeString,
        cacheId: 'urn:llm:repo:legacy',
      };

      const domain = mapper.toDomain(legacyRecord);

      expect(domain.attachments).toHaveLength(1);
      expect(domain.attachments[0].cacheId.toString()).toBe(
        'urn:llm:repo:legacy',
      );
      expect(domain.attachments[0].target).toBe('inline-context'); // Validates default legacy behavior
      expect(domain.attachments[0].id).toBeDefined(); // Validates UUID generation
    });
  });

  describe('toRecord', () => {
    it('should correctly serialize attachments and context groups for the database', () => {
      const domain: LlmSession = {
        id: URN.parse('urn:llm:session:3'),
        title: 'Save Session',
        lastModified: '2026-02-28T10:00:00Z' as ISODateTimeString,
        attachments: [
          {
            id: 'att-99',
            cacheId: URN.parse('urn:llm:repo:backend'),
            profileId: URN.parse('urn:llm:profile:dev'),
            target: 'inline-context',
          },
        ],
        contextGroups: {
          'urn:tag:test': 'Testing Context',
        },
      };

      const record = mapper.toRecord(domain);

      expect(record.attachments).toHaveLength(1);
      expect(record.attachments[0].cacheId).toBe('urn:llm:repo:backend');
      expect(record.attachments[0].profileId).toBe('urn:llm:profile:dev');
      expect(record.contextGroups?.['urn:tag:test']).toBe('Testing Context');
    });
  });
});
