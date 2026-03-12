import { TestBed } from '@angular/core/testing';
import { CompiledCacheService } from './compiled-cache.service';
import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { CompiledCacheStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { CompiledCache } from '@nx-platform-application/llm-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('CompiledCacheService', () => {
  let service: CompiledCacheService;

  const mockNetwork = { buildCache: vi.fn() };
  const mockStorage = {
    saveCache: vi.fn(),
    deleteCache: vi.fn(),
    getAllCaches: vi.fn().mockResolvedValue([]),
  };
  const mockLogger = { error: vi.fn(), info: vi.fn() };
  const mockSnackBar = { open: vi.fn() };

  const validCache: CompiledCache = {
    id: URN.parse('urn:gemini:compiled-cache:valid'),
    model: 'gemini-1.5-pro',
    provider: 'gemini',
    createdAt: '2026-01-01T00:00:00Z' as ISODateTimeString,
    expiresAt: '2030-01-01T00:00:00Z' as ISODateTimeString,
    sources: [
      { dataSourceId: URN.parse('urn:data-source:repo:alpha') },
      { dataSourceId: URN.parse('urn:data-source:repo:beta') },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getAllCaches.mockResolvedValue([]);

    TestBed.configureTestingModule({
      providers: [
        CompiledCacheService,
        { provide: LLM_NETWORK_CLIENT, useValue: mockNetwork },
        { provide: CompiledCacheStorageService, useValue: mockStorage },
        { provide: Logger, useValue: mockLogger },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    });
    service = TestBed.inject(CompiledCacheService);
  });

  describe('Content-Addressed Lookups', () => {
    it('should resolve a cache hit regardless of source array order (alphabetical hashing)', async () => {
      mockStorage.getAllCaches.mockResolvedValue([validCache]);
      await service.refresh();

      // Reverse order from the stored cache
      const requestedSources = [
        { dataSourceId: URN.parse('urn:data-source:repo:beta') },
        { dataSourceId: URN.parse('urn:data-source:repo:alpha') },
      ];

      const match = service.getValidCache(requestedSources, 'gemini-1.5-pro');

      expect(match).toBeDefined();
      expect(match?.id.toString()).toBe('urn:gemini:compiled-cache:valid');
    });

    it('should fail lookup if a profileId differs within the same repository', async () => {
      mockStorage.getAllCaches.mockResolvedValue([validCache]);
      await service.refresh();

      const requestedSourcesWithProfile = [
        {
          dataSourceId: URN.parse('urn:data-source:repo:alpha'),
          profileId: URN.parse('urn:data-source:profile:custom'),
        },
        { dataSourceId: URN.parse('urn:data-source:repo:beta') },
      ];

      const match = service.getValidCache(
        requestedSourcesWithProfile,
        'gemini-1.5-pro',
      );
      expect(match).toBeUndefined();
    });
  });

  describe('Compilation Actions', () => {
    it('should call network buildCache with zero session context', async () => {
      const mockResponse = {
        compiledCacheId: URN.parse('urn:gemini:compiled-cache:new'),
        expiresAt: '2026-03-15T10:00:00Z' as ISODateTimeString,
      };
      mockNetwork.buildCache.mockResolvedValue(mockResponse);

      const sources = [
        { dataSourceId: URN.parse('urn:data-source:repo:alpha') },
      ];
      await service.compileCache({ sources, model: 'gemini-1.5-pro' });

      // Check that the network client receives ONLY domain-relevant data
      expect(mockNetwork.buildCache).toHaveBeenCalledWith({
        model: 'gemini-1.5-pro',
        attachments: expect.arrayContaining([
          expect.objectContaining({ dataSourceId: sources[0].dataSourceId }),
        ]),
        expiresAtHint: expect.anything(),
      });
    });
  });
});
