import { TestBed } from '@angular/core/testing';
import { DigestStorageService } from './digest-storage.service';
import {
  LlmDatabase,
  LlmMemoryDigestMapper,
} from '@nx-platform-application/llm-infrastructure-indexed-db';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { LlmMemoryDigest } from '@nx-platform-application/llm-types';
import { Dexie } from 'dexie';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('DigestStorageService', () => {
  let service: DigestStorageService;
  let dbMock: any;
  let mapperMock: any;

  beforeEach(() => {
    dbMock = {
      digests: {
        put: vi.fn(),
        delete: vi.fn(),
        bulkDelete: vi.fn(),
        where: vi.fn().mockReturnThis(),
        between: vi.fn().mockReturnThis(),
        equals: vi.fn().mockReturnThis(),
        primaryKeys: vi.fn().mockResolvedValue(['urn:llm:digest:1']),
        toArray: vi.fn().mockResolvedValue([]),
      },
    };

    mapperMock = {
      toRecord: vi.fn(),
      toDomain: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        DigestStorageService,
        { provide: LlmDatabase, useValue: dbMock },
        { provide: LlmMemoryDigestMapper, useValue: mapperMock },
      ],
    });

    service = TestBed.inject(DigestStorageService);
  });

  it('should save a digest', async () => {
    const mockDigest = { id: URN.parse('urn:llm:digest:1') } as LlmMemoryDigest;
    const mockRecord = { id: 'urn:llm:digest:1' };

    mapperMock.toRecord.mockReturnValue(mockRecord);

    await service.saveDigest(mockDigest);
    expect(dbMock.digests.put).toHaveBeenCalledWith(mockRecord);
  });

  it('should query digests by session ID and timestamp', async () => {
    await service.getSessionDigests(URN.parse('urn:llm:session:123'));

    expect(dbMock.digests.where).toHaveBeenCalledWith('[sessionId+createdAt]');
    expect(dbMock.digests.between).toHaveBeenCalledWith(
      ['urn:llm:session:123', Dexie.minKey],
      ['urn:llm:session:123', Dexie.maxKey],
    );
  });

  it('should clear all digests for a session', async () => {
    await service.clearSessionDigests(URN.parse('urn:llm:session:456'));

    expect(dbMock.digests.where).toHaveBeenCalledWith('sessionId');
    expect(dbMock.digests.equals).toHaveBeenCalledWith('urn:llm:session:456');
    expect(dbMock.digests.bulkDelete).toHaveBeenCalledWith([
      'urn:llm:digest:1',
    ]);
  });

  const mockDigest = {
    id: URN.parse('urn:llm:digest:1'),
    sessionId: URN.parse('urn:llm:session:123'),
    registryEntities: [],
    coveredMessageIds: [],
    content: '',
    createdAt: '2026-03-09T10:00:00Z' as ISODateTimeString,
  } as LlmMemoryDigest;

  const mockRecord = {
    id: 'urn:llm:digest:1',
    sessionId: 'urn:llm:session:123',
    registryEntities: [],
    coveredMessageIds: [],
    content: '',
    createdAt: '2026-03-09T10:00:00Z',
  };
});
