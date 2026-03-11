import { TestBed } from '@angular/core/testing';
import { WorkspaceStateService } from './workspace.service';
import { signal } from '@angular/core';
import {
  LlmScrollSource,
  LlmSessionSource,
} from '@nx-platform-application/llm-features-chat';
import { GithubSyncClient } from '@nx-platform-application/data-sources-infrastructure-data-access';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';
import {
  FileLinkType,
  PointerPayload,
} from '@nx-platform-application/llm-types';
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';
import { DataSourcesService } from '@nx-platform-application/data-sources/features/state';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';

describe('WorkspaceStateService', () => {
  let service: WorkspaceStateService;

  const mockScrollSource = {
    items: signal<any[]>([]),
    activeSessionId: signal<URN | null>(null),
  };
  const mockSessionSource = {
    activeSessionId: signal<URN | null>(null),
    activeSession: signal<any>({
      id: URN.parse('urn:llm:session:123'),
      inlineContexts: [
        {
          resourceUrn: URN.parse('urn:data-source:repo:123'),
          resourceType: 'source',
        },
      ],
    }),
  };

  const mockSyncClient = {
    getFiles: vi.fn().mockReturnValue(of([])),
    getFileContent: vi.fn(),
  };
  const mockRegistry = {
    getProposalsForSession: vi.fn().mockResolvedValue([]),
    registryMutated: signal(0),
  };
  const mockCache = { activeCaches: signal([]), getValidCache: vi.fn() };
  const mockDataSources = { dataGroups: signal([]) };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        WorkspaceStateService,
        { provide: LlmScrollSource, useValue: mockScrollSource },
        { provide: LlmSessionSource, useValue: mockSessionSource },
        { provide: GithubSyncClient, useValue: mockSyncClient },
        { provide: LlmProposalService, useValue: mockRegistry },
        { provide: CompiledCacheService, useValue: mockCache },
        { provide: DataSourcesService, useValue: mockDataSources },
        {
          provide: Logger,
          useValue: { error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
        },
      ],
    });
    service = TestBed.inject(WorkspaceStateService);
  });

  it('should successfully build the overlayMap', async () => {
    const pointer: PointerPayload = {
      proposalId: URN.parse('urn:llm:proposal:p1'),
      filePath: 'src/main.ts',
      snippet: '',
    };
    mockScrollSource.items.set([
      {
        type: 'content',
        data: {
          typeId: FileLinkType,
          payloadBytes: new TextEncoder().encode(JSON.stringify(pointer)),
        },
      },
    ]);
    mockRegistry.getProposalsForSession.mockResolvedValue([
      {
        id: URN.parse('urn:llm:proposal:p1'),
        ownerSessionId: URN.parse('urn:llm:session:123'),
        filePath: 'src/main.ts',
        status: 'pending',
        createdAt: '2026-03-01T10:00:00Z',
      },
    ]);

    mockSessionSource.activeSessionId.set(URN.parse('urn:llm:session:123'));
    await new Promise(process.nextTick);

    expect(service.overlayMap().has('src/main.ts')).toBe(true);
  });
});
