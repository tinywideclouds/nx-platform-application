import { TestBed } from '@angular/core/testing';
import { LlmMemoryDigestMapper } from './digest.mapper';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { LlmMemoryDigestRecord } from '../records/memory.record';
import { LlmMemoryDigest } from '@nx-platform-application/llm-types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('LlmMemoryDigestMapper', () => {
  let mapper: LlmMemoryDigestMapper;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LlmMemoryDigestMapper] });
    mapper = TestBed.inject(LlmMemoryDigestMapper);
  });

  it('should cleanly map a full record to domain', () => {
    const record: LlmMemoryDigestRecord = {
      id: 'urn:llm:digest:123',
      sessionId: 'urn:llm:session:456',
      coveredMessageIds: ['urn:llm:message:1', 'urn:llm:message:2'],
      content: 'This is a summary.',
      editDeltaNotes: ['User deleted message 1'],
      createdAt: '2026-03-13T10:00:00Z',
    };

    const domain = mapper.toDomain(record);

    expect(domain.id.toString()).toBe('urn:llm:digest:123');
    expect(domain.sessionId.toString()).toBe('urn:llm:session:456');
    expect(domain.coveredMessageIds[0].toString()).toBe('urn:llm:message:1');
    expect(domain.content).toBe('This is a summary.');
    expect(domain.editDeltaNotes?.[0]).toBe('User deleted message 1');
  });

  it('should map domain to record', () => {
    const domain: LlmMemoryDigest = {
      id: URN.parse('urn:llm:digest:999'),
      typeId: URN.parse('urn:llm:prompt:standard'),
      sessionId: URN.parse('urn:llm:session:888'),
      coveredMessageIds: [URN.parse('urn:llm:message:5')],
      content: 'Another summary.',
      createdAt: '2026-03-13T12:00:00Z' as ISODateTimeString,
      startTime: '2026-03-13T09:00:00Z' as ISODateTimeString,
      endTime: '2026-03-13T11:30:00Z' as ISODateTimeString,
      registryEntities: [],
    };

    const record = mapper.toRecord(domain);

    expect(record.id).toBe('urn:llm:digest:999');
    expect(record.coveredMessageIds[0]).toBe('urn:llm:message:5');
    expect(record.editDeltaNotes).toBeUndefined();
  });

  // Updated fragment for digest.mapper.spec.ts
  it('should cleanly map a full record to domain including time boundaries', () => {
    const record: LlmMemoryDigestRecord = {
      id: 'urn:llm:digest:123',
      sessionId: 'urn:llm:session:456',
      typeId: 'urn:digest:standard:llm',
      coveredMessageIds: ['urn:llm:message:1'],
      registryEntities: ['urn:llm:proposal:p1'],
      content: 'Summary',
      includeProposals: true, // New field
      createdAt: '2026-03-16T09:00:00Z',
      startTime: '2026-03-16T08:00:00Z', // New field
      endTime: '2026-03-16T08:30:00Z', // New field
    };

    const domain = mapper.toDomain(record);

    expect(domain.startTime).toBe('2026-03-16T08:00:00Z');
    expect(domain.endTime).toBe('2026-03-16T08:30:00Z');
    expect(domain.includeProposals).toBe(true);
    expect(domain.registryEntities).toHaveLength(1);
  });
});
