import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { CompiledCache } from '@nx-platform-application/llm-types';
import { CompiledCacheMapper } from './compiled-cache.mapper';

describe('CompiledCacheMapper', () => {
  let mapper: CompiledCacheMapper;

  const mockDomain: CompiledCache = {
    id: URN.parse('urn:llm:compiled-cache:cachedContents/test-slash'),
    model: 'gemini-1.5-pro',
    provider: 'gemini',
    expiresAt: '2026-03-11T20:00:00Z' as ISODateTimeString,
    createdAt: '2026-03-11T19:00:00Z' as ISODateTimeString,
    sources: [URN.parse('urn:datasource:stream:123')],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CompiledCacheMapper] });
    mapper = TestBed.inject(CompiledCacheMapper);
  });

  it('should transform domain URNs into primitive strings in the record', () => {
    const record = mapper.toRecord(mockDomain);

    expect(typeof record.id).toBe('string');
    expect(record.id).toBe('urn:llm:compiled-cache:cachedContents/test-slash');
    expect(typeof record.sources[0]).toBe('string');
    expect(record.sources[0]).toBe('urn:datasource:stream:123');
  });

  it('should survive the Structured Clone Algorithm (IndexedDB Safety)', () => {
    const record = mapper.toRecord(mockDomain);
    expect(() => {
      structuredClone(record);
    }).not.toThrow();
  });

  it('should correctly hydrate URN instances back from the record', () => {
    const record = mapper.toRecord(mockDomain);
    const domain = mapper.toDomain(record);

    expect(domain.id).toBeInstanceOf(URN);
    expect(domain.sources[0]).toBeInstanceOf(URN);
    expect(domain.id.equals(mockDomain.id)).toBe(true);
  });
});
