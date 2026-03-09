import { TestBed } from '@angular/core/testing';
import { CompiledCacheMapper } from './compiled-cache.mapper';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { CompiledCacheRecord } from '../records/compiled-cache.record';
import { CompiledCache } from '@nx-platform-application/llm-types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('CompiledCacheMapper', () => {
  let mapper: CompiledCacheMapper;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CompiledCacheMapper],
    });
    mapper = TestBed.inject(CompiledCacheMapper);
  });

  const mockRecord: CompiledCacheRecord = {
    id: 'urn:gemini:compiled-cache:123',
    provider: 'gemini',
    expiresAt: '2026-03-09T18:00:00Z' as ISODateTimeString,
    createdAt: '2026-03-09T10:00:00Z' as ISODateTimeString,
    sources: [
      {
        dataSourceId: 'urn:data-source:repo1',
        profileId: 'urn:profile:prof1',
      },
      {
        dataSourceId: 'urn:data-source:repo2',
        // Omitting profileId to test the optional handling
      },
    ],
  };

  const mockDomain: CompiledCache = {
    id: URN.parse('urn:gemini:compiled-cache:123'),
    provider: 'gemini',
    expiresAt: '2026-03-09T18:00:00Z' as ISODateTimeString,
    createdAt: '2026-03-09T10:00:00Z' as ISODateTimeString,
    sources: [
      {
        dataSourceId: URN.parse('urn:data-source:repo1'),
        profileId: URN.parse('urn:profile:prof1'),
      },
      {
        dataSourceId: URN.parse('urn:data-source:repo2'),
      },
    ],
  };

  describe('toDomain', () => {
    it('should correctly map from Record to Domain, parsing URNs including nested arrays', () => {
      const domain = mapper.toDomain(mockRecord);

      expect(domain.id).toBeInstanceOf(URN);
      expect(domain.id.toString()).toBe('urn:gemini:compiled-cache:123');
      expect(domain.provider).toBe('gemini');
      expect(domain.expiresAt).toBe('2026-03-09T18:00:00Z');
      expect(domain.createdAt).toBe('2026-03-09T10:00:00Z');

      expect(domain.sources).toHaveLength(2);
      expect(domain.sources[0].dataSourceId).toBeInstanceOf(URN);
      expect(domain.sources[0].dataSourceId.toString()).toBe(
        'urn:data-source:repo1',
      );
      expect(domain.sources[0].profileId).toBeInstanceOf(URN);
      expect(domain.sources[0].profileId?.toString()).toBe('urn:profile:prof1');

      expect(domain.sources[1].dataSourceId).toBeInstanceOf(URN);
      expect(domain.sources[1].profileId).toBeUndefined();
    });
  });

  describe('toRecord', () => {
    it('should correctly map from Domain to Record, stringifying URNs securely', () => {
      const record = mapper.toRecord(mockDomain);

      expect(typeof record.id).toBe('string');
      expect(record.id).toBe('urn:gemini:compiled-cache:123');
      expect(record.provider).toBe('gemini');
      expect(record.expiresAt).toBe('2026-03-09T18:00:00Z');
      expect(record.createdAt).toBe('2026-03-09T10:00:00Z');

      expect(record.sources).toHaveLength(2);
      expect(typeof record.sources[0].dataSourceId).toBe('string');
      expect(record.sources[0].dataSourceId).toBe('urn:data-source:repo1');
      expect(typeof record.sources[0].profileId).toBe('string');

      expect(typeof record.sources[1].dataSourceId).toBe('string');
      expect(record.sources[1].profileId).toBeUndefined();
    });

    it('should default the provider to gemini if it is missing in the domain', () => {
      const domainWithoutProvider: CompiledCache = {
        ...mockDomain,
        provider: undefined,
      };

      const record = mapper.toRecord(domainWithoutProvider);
      expect(record.provider).toBe('gemini');
    });
  });
});
