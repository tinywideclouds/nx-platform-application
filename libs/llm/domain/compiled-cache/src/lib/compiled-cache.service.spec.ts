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
    getAllCaches: vi.fn().mockResolvedValue([]), // Added for the constructor's refresh()
  };
  const mockLogger = { error: vi.fn(), info: vi.fn() };
  const mockSnackBar = { open: vi.fn() };

  // Generate a valid cache far in the future
  const validCache: CompiledCache = {
    id: URN.parse('urn:gemini:compiled-cache:valid'),
    model: 'gemini-1.5-pro',
    provider: 'gemini',
    createdAt: '2026-01-01T00:00:00Z' as ISODateTimeString,
    expiresAt: '2030-01-01T00:00:00Z' as ISODateTimeString,
    sources: [
      { dataSourceId: URN.parse('urn:data-source:repo:1') },
      { dataSourceId: URN.parse('urn:data-source:repo:2') },
    ],
  };

  // Generate an expired cache far in the past
  const expiredCache: CompiledCache = {
    id: URN.parse('urn:gemini:compiled-cache:expired'),
    model: 'gemini-1.5-pro',
    provider: 'gemini',
    createdAt: '2020-01-01T00:00:00Z' as ISODateTimeString,
    expiresAt: '2021-01-01T00:00:00Z' as ISODateTimeString,
    sources: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getAllCaches.mockResolvedValue([]); // Default state

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

  describe('Registry & Lookups', () => {
    it('should passively purge expired caches on refresh', async () => {
      mockStorage.getAllCaches.mockResolvedValue([validCache, expiredCache]);

      await service.refresh();

      expect(mockStorage.deleteCache).toHaveBeenCalledWith(expiredCache.id);
      expect(mockStorage.deleteCache).not.toHaveBeenCalledWith(validCache.id);
      expect(service.activeCaches()).toEqual([validCache]);
    });

    it('should perfectly match sources via hash to find a valid cache, ignoring order', async () => {
      mockStorage.getAllCaches.mockResolvedValue([validCache]);
      await service.refresh();

      // Same sources, different order (should mathematically match!)
      const requestedSources = [
        { dataSourceId: URN.parse('urn:data-source:repo:2') },
        { dataSourceId: URN.parse('urn:data-source:repo:1') },
      ];

      const match = service.getValidCache(requestedSources, 'gemini-1.5-pro');
      expect(match).toBeDefined();
      expect(match?.id.toString()).toBe('urn:gemini:compiled-cache:valid');
    });

    it('should reject a cache match if the model differs or sources are missing', async () => {
      mockStorage.getAllCaches.mockResolvedValue([validCache]);
      await service.refresh();

      const requestedSources = [
        { dataSourceId: URN.parse('urn:data-source:repo:1') },
        { dataSourceId: URN.parse('urn:data-source:repo:2') },
      ];

      // Wrong model
      const wrongModel = service.getValidCache(
        requestedSources,
        'gemini-2.0-flash',
      );
      expect(wrongModel).toBeUndefined();

      // Incomplete sources
      const wrongSources = [
        { dataSourceId: URN.parse('urn:data-source:repo:1') },
      ];
      const wrongSourceMatch = service.getValidCache(
        wrongSources,
        'gemini-1.5-pro',
      );
      expect(wrongSourceMatch).toBeUndefined();
    });
  });

  describe('Actions', () => {
    it('should compile a cache successfully and save it to storage', async () => {
      const mockResponse = {
        compiledCacheId: URN.parse('urn:gemini:compiled-cache:123'),
        expiresAt: '2030-03-10T10:00:00Z' as ISODateTimeString,
      };
      mockNetwork.buildCache.mockResolvedValue(mockResponse);

      const sources = [{ dataSourceId: URN.parse('urn:data-source:repo:1') }];

      // UPGRADE: Pass the model property
      const result = await service.compileCache({
        sources,
        model: 'gemini-1.5-pro',
      });

      expect(result).toBeDefined();
      expect(result?.id.toString()).toBe('urn:gemini:compiled-cache:123');
      expect(result?.sources).toEqual(sources);
      expect(result?.model).toBe('gemini-1.5-pro');

      expect(mockNetwork.buildCache).toHaveBeenCalled();
      expect(mockStorage.saveCache).toHaveBeenCalledWith(result);
      expect(service.isCompiling()).toBe(false);
    });

    it('should handle compilation failures gracefully', async () => {
      mockNetwork.buildCache.mockRejectedValue(new Error('Network error'));

      const sources = [{ dataSourceId: URN.parse('urn:data-source:repo:1') }];
      const result = await service.compileCache({
        sources,
        model: 'gemini-1.5-pro',
      });

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to compile context cache.',
        'Close',
        expect.anything(),
      );
      expect(service.isCompiling()).toBe(false);
    });
  });
});
