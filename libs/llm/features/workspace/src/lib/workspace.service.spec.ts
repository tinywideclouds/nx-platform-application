import { TestBed } from '@angular/core/testing';
import { WorkspaceStateService } from './workspace.service';
import { signal } from '@angular/core';
import {
  LlmScrollSource,
  LlmSessionSource,
} from '@nx-platform-application/llm-features-chat';
import { LlmGithubFirestoreClient } from '@nx-platform-application/llm-infrastructure-github-firestore-access';
import { ProposalRegistryStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  FileLinkType,
  PointerPayload,
  RegistryEntry,
  LlmMessage,
} from '@nx-platform-application/llm-types';
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
      workspaceTarget: URN.parse('urn:llm:cache:123'),
      attachments: [
        { cacheId: URN.parse('urn:llm:cache:123'), target: 'compiled-cache' },
      ],
    }),
    sessions: signal([]),
  };

  const mockFirestoreClient = {
    // Return empty observables to satisfy the constructor effects
    getFiles: vi.fn().mockReturnValue(of([])),
    getFileContent: vi.fn(),
  };

  const mockRegistry = {
    getProposalsForSession: vi.fn().mockResolvedValue([]),
  };

  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        WorkspaceStateService,
        { provide: LlmScrollSource, useValue: mockScrollSource },
        { provide: LlmSessionSource, useValue: mockSessionSource },
        { provide: LlmGithubFirestoreClient, useValue: mockFirestoreClient },
        // Use the new domain service injection token
        { provide: 'LlmProposalService', useValue: mockRegistry },
        { provide: Logger, useValue: mockLogger },
      ],
    });
    service = TestBed.inject(WorkspaceStateService);
  });

  it('should successfully build the overlayMap by joining Pointers with Registry Data', async () => {
    // 1. Setup a Pointer Message in the UI Stream
    const encoder = new TextEncoder();
    const pointer: PointerPayload = {
      proposalId: URN.parse('urn:llm:proposal:prop-1'),
      filePath: 'src/main.ts',
      snippet: 'Preview',
    };

    const mockMessage: Partial<LlmMessage> = {
      typeId: FileLinkType,
      payloadBytes: encoder.encode(JSON.stringify(pointer)),
    };

    mockScrollSource.items.set([{ type: 'content', data: mockMessage }]);

    // 2. Setup the Heavy Registry Data
    const mockRegistryEntry: Partial<RegistryEntry> = {
      id: URN.parse('urn:llm:proposal:prop-1'),
      ownerSessionId: URN.parse('urn:llm:session:123'),
      filePath: 'src/main.ts',
      patch: '@@ -1 +1 @@\n+ Hello',
      status: 'pending',
      createdAt: '2026-03-01T10:00:00Z' as ISODateTimeString,
    };

    mockRegistry.getProposalsForSession.mockResolvedValue([mockRegistryEntry]);

    // 3. Trigger Effects
    mockSessionSource.activeSessionId.set(URN.parse('urn:llm:session:123'));
    TestBed.flushEffects();
    await new Promise(process.nextTick);

    // 4. Verify Engine Construction
    const overlay = service.overlayMap();
    expect(overlay.has('src/main.ts')).toBe(true);

    const record = overlay.get('src/main.ts')!;
    expect(record.proposalChain).toHaveLength(1);
    expect(record.proposalChain[0].id).toBe('urn:llm:proposal:prop-1');
    expect(record.proposalChain[0].patch).toBe('@@ -1 +1 @@\n+ Hello');
  });

  it('should correctly calculate resolveChainState by applying patches sequentially', () => {
    const record = {
      filePath: 'test.ts',
      isContentLoading: false,
      baseContent: 'Line 1\nLine 2\n',
      proposalChain: [
        {
          id: '1',
          sessionId: URN.parse('urn:llm:session:s1'),
          filePath: 'test.ts',
          patch: '@@ -1,2 +1,3 @@\n Line 1\n Line 2\n+Line 3\n',
          reasoning: '',
          status: 'pending' as const,
          createdAt: 'now' as ISODateTimeString,
        },
      ],
    };

    const result = service.resolveChainState(record);

    expect(result.error).toBeUndefined();
    expect(result.content).toBe('Line 1\nLine 2\nLine 3\n');
  });
});
