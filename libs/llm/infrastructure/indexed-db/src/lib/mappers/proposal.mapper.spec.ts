import { TestBed } from '@angular/core/testing';
import { ProposalMapper } from './proposal.mapper';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ProposalRecord } from '../records/proposal.record';
import { RegistryEntry } from '@nx-platform-application/llm-types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ProposalMapper', () => {
  let mapper: ProposalMapper;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProposalMapper],
    });
    mapper = TestBed.inject(ProposalMapper);
  });

  const mockRecord: ProposalRecord = {
    id: 'urn:llm:proposal:123',
    ownerSessionId: 'urn:llm:session:abc',
    filePath: 'src/main.ts',
    patch: '@@ -1 +1 @@',
    reasoning: 'Fixed bug',
    status: 'pending',
    createdAt: '2026-03-04T10:00:00Z' as ISODateTimeString,
  };

  const mockDomain: RegistryEntry = {
    id: URN.parse('urn:llm:proposal:123'),
    ownerSessionId: URN.parse('urn:llm:session:abc'),
    filePath: 'src/main.ts',
    patch: '@@ -1 +1 @@',
    reasoning: 'Fixed bug',
    status: 'pending',
    createdAt: '2026-03-04T10:00:00Z' as ISODateTimeString,
  };

  it('should map from Record (DB) to Domain', () => {
    const result = mapper.toDomain(mockRecord);
    expect(result).toEqual(mockDomain);
    expect(result.id).toBeInstanceOf(URN);
    expect(result.ownerSessionId).toBeInstanceOf(URN);
  });

  it('should map from Domain to Record (DB)', () => {
    const result = mapper.toRecord(mockDomain);
    expect(result).toEqual(mockRecord);
    expect(typeof result.id).toBe('string');
  });

  it('should handle missing patch/newContent gracefully', () => {
    const recordWithoutPatch: ProposalRecord = {
      ...mockRecord,
      patch: undefined,
      newContent: 'full content',
    };
    const result = mapper.toDomain(recordWithoutPatch);
    expect(result.patch).toBeUndefined();
    expect(result.newContent).toBe('full content');
  });
});
