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
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('CompiledCacheService', () => {
  let service: CompiledCacheService;

  const mockNetwork = { buildCache: vi.fn() };
  const mockStorage = { saveCache: vi.fn(), deleteCache: vi.fn() };
  const mockLogger = { error: vi.fn(), info: vi.fn() };
  const mockSnackBar = { open: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('should compile a cache successfully and save it to storage', async () => {
    const mockResponse = {
      compiledCacheId: URN.parse('urn:gemini:compiled-cache:123'),
      expiresAt: '2026-03-10T10:00:00Z' as ISODateTimeString,
    };
    mockNetwork.buildCache.mockResolvedValue(mockResponse);

    const sources = [{ dataSourceId: URN.parse('urn:data-source:repo:1') }];

    const result = await service.compileCache({ sources });

    expect(result).toBeDefined();
    expect(result?.id.toString()).toBe('urn:gemini:compiled-cache:123');
    expect(result?.sources).toEqual(sources);

    expect(mockNetwork.buildCache).toHaveBeenCalled();
    expect(mockStorage.saveCache).toHaveBeenCalledWith(result);
    expect(service.isCompiling()).toBe(false);
  });

  it('should handle compilation failures gracefully', async () => {
    mockNetwork.buildCache.mockRejectedValue(new Error('Network error'));

    const sources = [{ dataSourceId: URN.parse('urn:data-source:repo:1') }];
    const result = await service.compileCache({ sources });

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
