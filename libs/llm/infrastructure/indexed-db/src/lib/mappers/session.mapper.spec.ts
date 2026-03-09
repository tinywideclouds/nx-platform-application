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
    it('should correctly map a modern record and create a compiledCache stub', () => {
      const record: LlmSessionRecord = {
        id: 'urn:llm:session:1',
        title: 'Modern Session',
        lastModified: '2026-02-28T10:00:00Z' as ISODateTimeString,
        compiledCacheId: 'urn:gemini:compiled-cache:123',
        attachments: [],
      };

      const domain = mapper.toDomain(record);

      // Verify the stub was created
      expect(domain.compiledCache).toBeDefined();
      expect(domain.compiledCache?.id.toString()).toBe(
        'urn:gemini:compiled-cache:123',
      );
      expect(domain.compiledCache?.expiresAt).toBe(''); // Verifying stub nature
    });

    it('should auto-migrate legacy cache objects into a stub', () => {
      const legacyRecord: any = {
        id: 'urn:llm:session:2',
        title: 'Legacy Session',
        lastModified: '2026-02-28T10:00:00Z' as ISODateTimeString,
        compiledCache: { id: 'cached/999' },
      };

      const domain = mapper.toDomain(legacyRecord);
      expect(domain.compiledCache?.id.toString()).toBe(
        'urn:gemini:compiled-cache:cached/999',
      );
    });
  });

  describe('toRecord', () => {
    it('should correctly flatten the rich object to the database foreign key', () => {
      const domain: LlmSession = {
        id: URN.parse('urn:llm:session:3'),
        title: 'Save Session',
        lastModified: '2026-02-28T10:00:00Z' as ISODateTimeString,
        compiledCache: {
          id: URN.parse('urn:gemini:compiled-cache:456'),
          provider: 'gemini',
          expiresAt: '2026-03-09T18:00:00Z' as ISODateTimeString,
          createdAt: '2026-03-09T10:00:00Z' as ISODateTimeString,
          sources: [],
        },
        attachments: [],
      };

      const record = mapper.toRecord(domain);

      expect(record.compiledCacheId).toBe('urn:gemini:compiled-cache:456');
      expect((record as any).compiledCache).toBeUndefined(); // Should NOT save the object
    });
  });
});
