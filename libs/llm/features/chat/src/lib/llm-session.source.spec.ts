import { TestBed } from '@angular/core/testing';
import { LlmSessionSource } from './llm-session.source';
import {
  SessionStorageService,
  CompiledCacheStorageService,
} from '@nx-platform-application/llm-infrastructure-storage';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LlmSessionSource', () => {
  let service: LlmSessionSource;
  let mockSessionStorage: any;
  let mockCacheStorage: any;

  beforeEach(() => {
    mockSessionStorage = {
      getSessions: vi.fn().mockResolvedValue([]),
    };
    mockCacheStorage = {
      getCache: vi.fn().mockResolvedValue(null),
    };

    TestBed.configureTestingModule({
      providers: [
        LlmSessionSource,
        { provide: SessionStorageService, useValue: mockSessionStorage },
        { provide: CompiledCacheStorageService, useValue: mockCacheStorage },
      ],
    });

    service = TestBed.inject(LlmSessionSource);
  });

  it('should hydrate sessions and their compiled caches from storage on initialization', async () => {
    const mockSessions = [
      {
        id: URN.parse('urn:llm:session:1'),
        title: 'Test',
        compiledCache: { id: URN.parse('urn:gemini:compiled-cache:xyz') }, // The stub from the mapper
      },
    ];
    mockSessionStorage.getSessions.mockResolvedValue(mockSessions);

    const mockFullCache = {
      id: URN.parse('urn:gemini:compiled-cache:xyz'),
      provider: 'gemini',
      expiresAt: '2026-03-09T18:00:00Z' as ISODateTimeString,
    };
    mockCacheStorage.getCache.mockResolvedValue(mockFullCache);

    await service.refresh();

    expect(mockSessionStorage.getSessions).toHaveBeenCalled();
    expect(mockCacheStorage.getCache).toHaveBeenCalledWith(
      URN.parse('urn:gemini:compiled-cache:xyz'),
    );

    const sessions = service.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].compiledCache).toEqual(mockFullCache);
  });

  it('should strip the compiledCache stub if the actual cache record is missing from the DB', async () => {
    const mockSessions = [
      {
        id: URN.parse('urn:llm:session:1'),
        title: 'Test',
        compiledCache: { id: URN.parse('urn:gemini:compiled-cache:xyz') },
      },
    ];
    mockSessionStorage.getSessions.mockResolvedValue(mockSessions);
    mockCacheStorage.getCache.mockResolvedValue(undefined); // Missing cache

    await service.refresh();

    const sessions = service.sessions();
    expect(sessions[0].compiledCache).toBeUndefined();
  });

  it('should instantly add an optimistic session to the top of the list', () => {
    const urn = URN.parse('urn:llm:session:new');
    service.addOptimisticSession(urn);

    const sessions = service.sessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(urn);
    expect((sessions[0] as any).isOptimistic).toBe(true);
    expect(sessions[0].attachments).toEqual([]);
  });
});
