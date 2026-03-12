import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { LlmSession } from '@nx-platform-application/llm-types';
import { LlmSessionMapper } from './session.mapper';
import { LlmSessionRecord } from '../records/session.record';

describe('LlmSessionMapper', () => {
  let mapper: LlmSessionMapper;

  const mockDomain: LlmSession = {
    id: URN.parse('urn:llm:session:123'),
    title: 'Strategy Test',
    lastModified: '2026-03-12T10:00:00Z' as ISODateTimeString,
    llmModel: 'gemini-3-flash-preview',
    strategy: {
      primaryModel: 'gemini-3-flash-preview',
      secondaryModel: 'gemini-3.1-pro-preview',
      secondaryModelLimit: 5,
      fallbackStrategy: 'history_only',
      useCacheIfAvailable: true,
    },
    inlineContexts: [
      {
        id: URN.parse('urn:llm:attachment:1'),
        resourceUrn: URN.parse('urn:data-source:repo:abc'),
        resourceType: 'source',
      },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LlmSessionMapper] });
    mapper = TestBed.inject(LlmSessionMapper);
  });

  it('should correctly flatten the model strategy into the record', () => {
    const record = mapper.toRecord(mockDomain);

    expect(record.llmModel).toBe('gemini-3-flash-preview');
    expect(record.primaryModel).toBe('gemini-3-flash-preview');
    expect(record.secondaryModel).toBe('gemini-3.1-pro-preview');
    expect(record.fallbackStrategy).toBe('history_only');
    expect(record.useCacheIfAvailable).toBe(true);
  });

  it('should hydrate a complete strategy object back into the domain', () => {
    const record = mapper.toRecord(mockDomain);
    const domain = mapper.toDomain(record);

    expect(domain.strategy).toBeDefined();
    expect(domain.strategy?.secondaryModelLimit).toBe(5);
    expect(domain.strategy?.fallbackStrategy).toBe('history_only');
    expect(domain.llmModel).toBe('gemini-3-flash-preview');
  });

  it('should handle legacy records missing strategy fields by providing defaults', () => {
    const legacyRecord: any = {
      id: 'urn:llm:session:legacy',
      title: 'Old Session',
      lastModified: '2025-01-01T00:00:00Z',
      llmModel: 'gemini-1.5-flash',
    };

    const domain = mapper.toDomain(legacyRecord as LlmSessionRecord);

    expect(domain.strategy).toBeDefined();
    expect(domain.strategy?.fallbackStrategy).toBe('inline'); // Default
    expect(domain.strategy?.primaryModel).toBe('gemini-1.5-flash');
  });

  it('should ensure all URNs are strings in the record (Structured Clone Safety)', () => {
    const record = mapper.toRecord(mockDomain);

    expect(typeof record.id).toBe('string');
    expect(typeof record.inlineContexts![0].resourceUrn).toBe('string');

    expect(() => {
      structuredClone(record);
    }).not.toThrow();
  });
});
