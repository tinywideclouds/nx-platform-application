import { TestBed } from '@angular/core/testing';
import { CompiledCacheStorageService } from './compiled-cache-storage.service';
import {
  LlmDatabase,
  CompiledCacheMapper,
} from '@nx-platform-application/llm-infrastructure-indexed-db';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { CompiledCache } from '@nx-platform-application/llm-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('CompiledCacheStorageService', () => {
  let service: CompiledCacheStorageService;
  let dbMock: any;
  let mapperMock: any;

  beforeEach(() => {
    dbMock = {
      compiledCaches: {
        put: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        bulkDelete: vi.fn(),
        orderBy: vi.fn().mockReturnThis(),
        reverse: vi.fn().mockReturnThis(),
        toArray: vi.fn(),
        where: vi.fn().mockReturnThis(),
        below: vi.fn().mockReturnThis(),
        primaryKeys: vi.fn(),
      },
    };

    mapperMock = {
      toRecord: vi.fn(),
      toDomain: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        CompiledCacheStorageService,
        { provide: LlmDatabase, useValue: dbMock },
        { provide: CompiledCacheMapper, useValue: mapperMock },
      ],
    });

    service = TestBed.inject(CompiledCacheStorageService);
  });

  const mockCache: CompiledCache = {
    id: URN.parse('urn:gemini:compiled-cache:1'),
    provider: 'gemini',
    expiresAt: '2026-03-09T18:00:00Z' as ISODateTimeString,
    createdAt: '2026-03-09T10:00:00Z' as ISODateTimeString,
    sources: [],
  };

  const mockRecord = {
    id: 'urn:gemini:compiled-cache:1',
    provider: 'gemini',
    expiresAt: '2026-03-09T18:00:00Z',
    createdAt: '2026-03-09T10:00:00Z',
    sources: [],
  };

  it('should save a compiled cache', async () => {
    mapperMock.toRecord.mockReturnValue(mockRecord);
    await service.saveCache(mockCache);
    expect(mapperMock.toRecord).toHaveBeenCalledWith(mockCache);
    expect(dbMock.compiledCaches.put).toHaveBeenCalledWith(mockRecord);
  });

  it('should retrieve a compiled cache by URN', async () => {
    dbMock.compiledCaches.get.mockResolvedValue(mockRecord);
    mapperMock.toDomain.mockReturnValue(mockCache);

    const result = await service.getCache(mockCache.id);

    expect(dbMock.compiledCaches.get).toHaveBeenCalledWith(
      'urn:gemini:compiled-cache:1',
    );
    expect(mapperMock.toDomain).toHaveBeenCalledWith(mockRecord);
    expect(result).toEqual(mockCache);
  });

  it('should return undefined if cache is not found', async () => {
    dbMock.compiledCaches.get.mockResolvedValue(undefined);
    const result = await service.getCache(mockCache.id);
    expect(result).toBeUndefined();
  });

  it('should delete expired caches safely', async () => {
    const expiredKeys = ['urn:1', 'urn:2'];
    dbMock.compiledCaches.primaryKeys.mockResolvedValue(expiredKeys);

    await service.deleteExpiredCaches('2026-03-09T12:00:00Z');

    expect(dbMock.compiledCaches.where).toHaveBeenCalledWith('expiresAt');
    expect(dbMock.compiledCaches.below).toHaveBeenCalledWith(
      '2026-03-09T12:00:00Z',
    );
    expect(dbMock.compiledCaches.bulkDelete).toHaveBeenCalledWith(expiredKeys);
  });
});
